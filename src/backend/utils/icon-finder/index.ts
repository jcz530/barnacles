/**
 * Project icon detection.
 *
 * Four tiers contribute candidates to a single pool, and `scoring.ts` picks the
 * winner. Tiers exist to bound work, not to decide correctness: a later tier
 * runs only when earlier ones found nothing convincing, but if it does run, its
 * candidates compete on equal terms.
 *
 *   0  declared config   -- what the project says its icon is
 *   1  conventions       -- known filenames in known directories
 *   2  nested apps       -- the same two tiers inside a monorepo's sub-app
 *   3  bounded walk      -- last resort, capped and ignoring build output
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { readDeclaredIcons } from './declared-sources';
import {
  CONFIDENT_SCORE,
  CONVENTION_DIRS,
  IGNORED_DIRS,
  LIMITS,
  NESTED_APP_DIRS,
  NESTED_APP_MARKERS,
} from './definitions';
import {
  compareCandidates,
  hasIconName,
  type IconCandidate,
  rankCandidates,
  scoreCandidate,
  toPosix,
} from './scoring';
import { collectImageFiles, listImagesIn, mapWithConcurrency, readDirSorted } from './walker';

export type { IconCandidate } from './scoring';

function hasConfidentCandidate(candidates: IconCandidate[]): boolean {
  return candidates.some(candidate => candidate.score >= CONFIDENT_SCORE);
}

/**
 * Tier 1: conventional filenames in conventional directories.
 *
 * A conventional location is not on its own enough to call a file an icon --
 * `assets/` holds theme screenshots and `public/` holds hero art and framework
 * placeholders. Requiring a recognizable icon name keeps those out, at the cost
 * of missing an icon with a wholly idiosyncratic name; that trade favours the
 * honest folder glyph over a confidently wrong picture.
 */
async function findConventionIcons(
  appRoot: string,
  relativeTo = '',
  depth = 0
): Promise<IconCandidate[]> {
  const perDir = await mapWithConcurrency(CONVENTION_DIRS, LIMITS.CONCURRENCY, async dir => {
    const names = await listImagesIn(path.join(appRoot, dir));
    return names
      .filter(name => hasIconName(name))
      .map(name => {
        const withinApp = dir ? `${dir}/${name}` : name;
        const relPath = relativeTo ? `${toPosix(relativeTo)}/${withinApp}` : withinApp;
        return scoreCandidate(relPath, 'convention', depth);
      });
  });

  return perDir.flat();
}

async function isApp(dirPath: string): Promise<boolean> {
  for (const marker of NESTED_APP_MARKERS) {
    try {
      if ((await fs.stat(path.join(dirPath, marker))).isFile()) return true;
    } catch {
      // Marker absent; keep looking.
    }
  }
  return false;
}

/**
 * Nested application directories, best guesses first.
 *
 * Conventionally named children (`frontend/`, `web/`) are checked before a
 * general scan, and monorepo container directories are expanded one level so
 * `apps/web` is reachable. Only directories carrying their own manifest count.
 */
async function findNestedApps(projectPath: string): Promise<string[]> {
  const entries = await readDirSorted(projectPath);
  const dirNames = entries
    .filter(entry => entry.isDirectory() && !IGNORED_DIRS.has(entry.name.toLowerCase()))
    .filter(entry => !entry.name.startsWith('.'))
    .map(entry => entry.name);

  const preferred = NESTED_APP_DIRS.filter(name => dirNames.includes(name));
  const ordered = [...preferred, ...dirNames.filter(name => !preferred.includes(name))];

  const apps: string[] = [];

  for (const name of ordered) {
    if (apps.length >= LIMITS.MAX_NESTED_APPS) break;

    const dirPath = path.join(projectPath, name);

    if (await isApp(dirPath)) {
      apps.push(name);
      continue;
    }

    // A container such as apps/ or packages/ holds the real apps one level in.
    for (const child of (await readDirSorted(dirPath)).filter(
      entry => entry.isDirectory() && !IGNORED_DIRS.has(entry.name.toLowerCase())
    )) {
      if (apps.length >= LIMITS.MAX_NESTED_APPS) break;
      if (await isApp(path.join(dirPath, child.name))) apps.push(`${name}/${child.name}`);
    }
  }

  return apps;
}

/** Tier 2: run tiers 0 and 1 inside each nested app. */
async function findNestedAppIcons(projectPath: string): Promise<IconCandidate[]> {
  const apps = await findNestedApps(projectPath);

  const perApp = await mapWithConcurrency(apps, LIMITS.CONCURRENCY, async appDir => {
    const appRoot = path.join(projectPath, appDir);
    const depth = appDir.split('/').length;
    return [
      ...(await readDeclaredIcons(appRoot, appDir, depth)),
      ...(await findConventionIcons(appRoot, appDir, depth)),
    ];
  });

  return perApp.flat();
}

/**
 * Tier 3: bounded breadth-first walk, used only when nothing else matched.
 *
 * Only files whose *name* reads as an icon are accepted. Repositories are full
 * of images that are not icons -- screenshots, webfont glyphs, generated art --
 * and showing one of those is worse than showing the folder glyph, because a
 * confidently wrong icon gives the user nothing to correct. A project with no
 * recognizable icon should honestly report that it has none.
 */
async function findByWalking(projectPath: string): Promise<IconCandidate[]> {
  const files = await collectImageFiles(projectPath);

  return files
    .map(relPath => scoreCandidate(relPath, 'glob'))
    .filter(candidate => hasIconName(candidate.path));
}

/**
 * Every icon candidate for a project, best first.
 *
 * Exported so a future icon picker can offer the ranked alternatives without
 * re-deriving any of this.
 */
export async function findProjectIconCandidates(projectPath: string): Promise<IconCandidate[]> {
  try {
    if (!(await fs.stat(projectPath)).isDirectory()) return [];
  } catch {
    // Unreadable or missing project directory -- an unmounted drive, say.
    return [];
  }

  const candidates: IconCandidate[] = [
    ...(await readDeclaredIcons(projectPath)),
    ...(await findConventionIcons(projectPath)),
  ];

  if (!hasConfidentCandidate(candidates)) {
    candidates.push(...(await findNestedAppIcons(projectPath)));
  }

  if (candidates.length === 0) {
    candidates.push(...(await findByWalking(projectPath)));
  }

  return rankCandidates(candidates);
}

/**
 * Finds the best icon for a project.
 *
 * @param projectPath The root path of the project
 * @returns POSIX path to the icon relative to the project root, or null
 */
export async function findProjectIcon(projectPath: string): Promise<string | null> {
  const candidates = await findProjectIconCandidates(projectPath);

  // Verify only the winner: a zero-byte image would otherwise be stored and then
  // silently fail to render, which looks identical to having no icon at all.
  for (const candidate of candidates) {
    try {
      const stats = await fs.stat(path.join(projectPath, candidate.path));
      if (stats.isFile() && stats.size > 0) return candidate.path;
    } catch {
      // Vanished between listing and stat; try the next one.
    }
  }

  return null;
}

export { compareCandidates, scoreCandidate };
