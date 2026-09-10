/**
 * Reads icons a project declares about itself.
 *
 * A declared icon is authoritative in a way a filename guess never is, so these
 * are the highest-weighted candidates. Every declared path is verified on disk
 * before it becomes one -- config routinely outlives the file it points at.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { LIMITS, RENDERABLE_EXTENSIONS } from './definitions';
import { extname, type IconCandidate, scoreCandidate, toPosix } from './scoring';

/*
 * Global regexes carry `lastIndex` between calls, and every pattern below is
 * used against many files. They are built fresh per call so a previous match
 * can never cause the next one to start mid-string and silently find nothing.
 */

/**
 * electron-builder keeps `icon:` at the top level and under each platform. We
 * need those few scalars and nothing else, so we match the lines directly
 * rather than depending on a YAML parser: js-yaml reaches this project only
 * transitively through a devDependency and would not exist at runtime in a
 * packaged build. A malformed match costs us a candidate, nothing more.
 */
const yamlIconLine = () => /^[ \t]*icon:[ \t]*["']?([^"'#\n]+?)["']?[ \t]*(?:#.*)?$/gm;

/** `<link rel="icon">`, `apple-touch-icon`, `mask-icon`, and friends. */
const htmlIconLink = () => /<link\b[^>]*\brel=["']([^"']*icon[^"']*)["'][^>]*>/gi;
const HREF_ATTR = /\bhref=["']([^"']+)["']/i;

/** Nuxt/Astro configs declare the same links as object literals. */
const configIconEntry = () => /rel:\s*["'][^"']*icon[^"']*["'][^}]*?href:\s*["']([^"']+)["']/gi;

async function readTextFile(filePath: string): Promise<string | null> {
  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile() || stats.size > LIMITS.MAX_CONFIG_BYTES) return null;
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    return (await fs.stat(filePath)).isFile();
  } catch {
    return false;
  }
}

/**
 * Directories a web-root-relative href resolves against. An href like
 * `/favicon.svg` means the *served* root, which on disk is public/ or static/;
 * '' covers build configs whose paths are already repo-relative.
 */
const SERVED_ROOTS = ['', 'public', 'static'];

/**
 * Turns a declared reference into real, renderable files under `appRoot`.
 *
 * Handles the shapes config throws at us: electron-builder's extension-less
 * basename (`assets/icons/app`), expanded against every renderable extension;
 * `.icns`, which no browser can draw -- rather than dropping it we re-resolve
 * its basename and find the sibling PNG the author also generated, keeping the
 * intent instead of discarding it; and web-root-relative hrefs, which have to
 * be tried against each served root.
 */
async function resolveDeclaredPath(appRoot: string, declared: string): Promise<string[]> {
  const trimmed = toPosix(declared.trim()).split(/[?#]/)[0];
  const wasWebAbsolute = trimmed.startsWith('/');
  const cleaned = trimmed.replace(/^\.\//, '').replace(/^\//, '');

  // Parent-escaping references are not ours to serve.
  if (!cleaned || cleaned.startsWith('..') || path.isAbsolute(cleaned)) return [];
  // Data URIs and remote icons have no file to point at.
  if (/^[a-z][a-z0-9+.-]*:/i.test(cleaned)) return [];

  const ext = extname(cleaned);

  if (ext === '.icns') {
    const withoutExt = cleaned.slice(0, -ext.length);
    return resolveDeclaredPath(appRoot, wasWebAbsolute ? `/${withoutExt}` : withoutExt);
  }

  // A repo-relative build path resolves only at the root; a web path could be
  // served from any of the roots, so try each and let scoring rank the hits.
  const roots = wasWebAbsolute ? SERVED_ROOTS : [''];
  const hits: string[] = [];

  for (const root of roots) {
    const candidates = (RENDERABLE_EXTENSIONS as readonly string[]).includes(ext)
      ? [cleaned]
      : // No usable extension: treat it as a basename and expand.
        RENDERABLE_EXTENSIONS.map(candidateExt => cleaned + candidateExt);

    for (const candidate of candidates) {
      const relPath = root ? `${root}/${candidate}` : candidate;
      if (await fileExists(path.join(appRoot, relPath))) hits.push(relPath);
    }

    // Prefer the shallowest root that actually has the file.
    if (hits.length > 0) break;
  }

  return hits;
}

function matchAll(source: string, pattern: RegExp): string[] {
  return [...source.matchAll(pattern)].map(match => match[1]).filter(Boolean);
}

async function readElectronBuilderIcons(appRoot: string): Promise<string[]> {
  for (const name of ['electron-builder.yml', 'electron-builder.yaml']) {
    const content = await readTextFile(path.join(appRoot, name));
    if (content) {
      // `$` interpolation is an electron-builder macro, not a path.
      return matchAll(content, yamlIconLine())
        .map(value => value.trim())
        .filter(value => value && !value.includes('${'));
    }
  }

  for (const name of ['electron-builder.json', 'electron-builder.json5']) {
    const content = await readTextFile(path.join(appRoot, name));
    if (content) return collectJsonIcons(content);
  }

  const pkg = await readTextFile(path.join(appRoot, 'package.json'));
  if (pkg) {
    try {
      const parsed = JSON.parse(pkg);
      if (parsed?.build) return collectIconFields(parsed.build);
    } catch {
      // A package.json we cannot parse is not a signal worth reporting.
    }
  }

  return [];
}

function collectJsonIcons(content: string): string[] {
  try {
    return collectIconFields(JSON.parse(content));
  } catch {
    return [];
  }
}

/** Pulls every `icon` string from a builder config, at any nesting level. */
function collectIconFields(config: unknown, depth = 0): string[] {
  if (depth > 3 || !config || typeof config !== 'object') return [];

  const found: string[] = [];
  for (const [key, value] of Object.entries(config as Record<string, unknown>)) {
    if (key === 'icon' && typeof value === 'string') {
      found.push(value);
    } else if (value && typeof value === 'object') {
      found.push(...collectIconFields(value, depth + 1));
    }
  }
  return found;
}

/**
 * Files that carry the document head. Astro, Nuxt and Vue projects have no
 * top-level index.html -- their `<link rel="icon">` lives in a layout template,
 * so scanning only index.html would miss the declaration entirely.
 */
const HTML_HEAD_FILES = [
  'index.html',
  'public/index.html',
  'src/index.html',
  'src/layouts/BaseLayout.astro',
  'src/layouts/Layout.astro',
  'src/app.html',
  'app/root.tsx',
];

/** Layout directories to sweep when no known head file matched. */
const HTML_HEAD_DIRS = ['src/layouts', 'layouts', 'src/pages'];
const HTML_HEAD_EXTENSIONS = ['.astro', '.html', '.vue'];

function extractIconHrefs(content: string): string[] {
  const hrefs: string[] = [];
  for (const tag of [...content.matchAll(htmlIconLink())].map(match => match[0])) {
    const href = tag.match(HREF_ATTR)?.[1];
    // Skip template interpolation -- there is no literal path to resolve.
    if (href && !href.includes('{') && !href.includes('$')) hrefs.push(href);
  }
  return hrefs;
}

async function readHtmlIcons(appRoot: string): Promise<string[]> {
  const found: string[] = [];

  for (const name of HTML_HEAD_FILES) {
    const content = await readTextFile(path.join(appRoot, name));
    if (content) found.push(...extractIconHrefs(content));
  }

  if (found.length > 0) return found;

  // Nothing at a known path: sweep the layout directories, capped so an
  // unusual project cannot turn this into an unbounded read.
  for (const dir of HTML_HEAD_DIRS) {
    let entries: string[];
    try {
      entries = (await fs.readdir(path.join(appRoot, dir))).sort();
    } catch {
      continue;
    }

    for (const entry of entries.slice(0, LIMITS.MAX_HEAD_FILES)) {
      if (!HTML_HEAD_EXTENSIONS.some(ext => entry.toLowerCase().endsWith(ext))) continue;
      const content = await readTextFile(path.join(appRoot, dir, entry));
      if (content) found.push(...extractIconHrefs(content));
    }

    if (found.length > 0) break;
  }

  return found;
}

async function readFrameworkConfigIcons(appRoot: string): Promise<string[]> {
  const found: string[] = [];

  for (const name of ['nuxt.config.ts', 'nuxt.config.js', 'app.config.ts']) {
    const content = await readTextFile(path.join(appRoot, name));
    if (content) found.push(...matchAll(content, configIconEntry()));
  }

  return found;
}

/**
 * Web manifests reference icons through `public/`, so a manifest at
 * `public/favicon/site.webmanifest` naming `/favicon/favicon-96x96.png` has to
 * resolve against the served root rather than the manifest's own directory.
 */
async function readWebmanifestIcons(appRoot: string): Promise<string[]> {
  const locations = [
    'site.webmanifest',
    'manifest.json',
    'manifest.webmanifest',
    'public/site.webmanifest',
    'public/manifest.json',
    'public/favicon/site.webmanifest',
    'static/site.webmanifest',
    'static/manifest.json',
  ];

  const found: string[] = [];

  for (const location of locations) {
    const content = await readTextFile(path.join(appRoot, location));
    if (!content) continue;

    try {
      const parsed = JSON.parse(content);
      const icons = Array.isArray(parsed?.icons) ? parsed.icons : [];
      const servedRoot = location.startsWith('public/')
        ? 'public'
        : location.startsWith('static/')
          ? 'static'
          : '';

      for (const icon of icons) {
        if (typeof icon?.src !== 'string') continue;
        const src = toPosix(icon.src).replace(/^\.\//, '');
        found.push(servedRoot ? `${servedRoot}/${src.replace(/^\//, '')}` : src);
      }
    } catch {
      // Ignore an unparsable manifest.
    }
  }

  return found;
}

/**
 * Every icon `appRoot` declares about itself, scored and verified to exist.
 * `relativeTo` prefixes results when the app is nested inside the project.
 */
export async function readDeclaredIcons(
  appRoot: string,
  relativeTo = '',
  depth = 0
): Promise<IconCandidate[]> {
  const groups = [
    { source: 'electron-builder' as const, paths: await readElectronBuilderIcons(appRoot) },
    { source: 'html-link' as const, paths: await readHtmlIcons(appRoot) },
    { source: 'framework-config' as const, paths: await readFrameworkConfigIcons(appRoot) },
    { source: 'webmanifest' as const, paths: await readWebmanifestIcons(appRoot) },
  ];

  const candidates: IconCandidate[] = [];

  for (const { source, paths } of groups) {
    for (const declared of paths) {
      for (const resolved of await resolveDeclaredPath(appRoot, declared)) {
        const relPath = relativeTo ? `${toPosix(relativeTo)}/${resolved}` : resolved;
        candidates.push(scoreCandidate(relPath, source, depth));
      }
    }
  }

  return candidates;
}
