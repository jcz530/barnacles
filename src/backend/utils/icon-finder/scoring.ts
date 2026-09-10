/**
 * Scoring and ordering for icon candidates.
 *
 * Detection tiers collect candidates into one pool rather than short-circuiting
 * on the first hit; this module alone decides which one wins. That keeps
 * "declared beats conventional" a property of the scores instead of control
 * flow, and makes the outcome reproducible across rescans.
 */

import {
  BUILD_OUTPUT_SEGMENTS,
  EXT_WEIGHT,
  type IconSource,
  NAME_RULES,
  PENALTIES,
  SOURCE_WEIGHT,
  SUPPORTING_ROLE_DIRS,
} from './definitions';

export interface IconCandidate {
  /** POSIX path relative to the project root. */
  path: string;
  score: number;
  source: IconSource;
  /** Levels of app nesting below the project root (0 for the root app). */
  depth: number;
}

/** Path helpers that always speak POSIX, whatever the host separator is. */
export function toPosix(value: string): string {
  return value.split('\\').join('/');
}

function segments(relPath: string): string[] {
  return relPath.split('/').filter(Boolean);
}

function basename(relPath: string): string {
  const parts = segments(relPath);
  return parts.length > 0 ? parts[parts.length - 1] : '';
}

function dirname(relPath: string): string {
  return segments(relPath).slice(0, -1).join('/');
}

export function extname(relPath: string): string {
  const name = basename(relPath);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot).toLowerCase() : '';
}

export function stem(relPath: string): string {
  const name = basename(relPath);
  const dot = name.lastIndexOf('.');
  return (dot > 0 ? name.slice(0, dot) : name).toLowerCase();
}

/**
 * Whether the basename reads as an icon rather than as some other image. Used
 * to keep the unguided walk from offering screenshots or webfont glyphs.
 */
export function hasIconName(relPath: string): boolean {
  return NAME_RULES.some(rule => rule.test.test(stem(relPath)));
}

function nameWeight(relPath: string): number {
  const candidate = stem(relPath);
  for (const rule of NAME_RULES) {
    if (rule.test.test(candidate)) return rule.weight;
  }
  return 0;
}

/** Whether any path segment marks compiled output. */
function isBuildOutput(relPath: string): boolean {
  return segments(dirname(relPath)).some(segment =>
    BUILD_OUTPUT_SEGMENTS.includes(segment.toLowerCase())
  );
}

/**
 * Rewards proximity to a directory that actually serves assets, and charges a
 * small amount per extra path segment so shallower candidates win ties.
 *
 * Compiled output earns none of these bonuses. `public/spa/favicon/` looks like
 * a served icon directory by name, so without this a built copy would recover
 * most of its penalty and outrank the source it was generated from.
 */
function dirWeight(relPath: string): number {
  const dir = dirname(relPath);
  if (isBuildOutput(relPath)) return -segments(dir).length * 3;

  let weight = 0;

  if (/^(public|static)(\/|$)/.test(dir)) weight += 60;
  if (dir === '') weight += 40;
  if (/(^|\/)(favicon|icons?|img)(\/|$)/.test(dir)) weight += 30;
  if (/^(src|app|resources)(\/|$)/.test(dir)) weight += 10;

  weight -= segments(dir).length * 3;
  return weight;
}

function penalties(relPath: string, depth: number): number {
  const dir = dirname(relPath);
  const dirSegments = segments(dir);
  let total = 0;

  if (isBuildOutput(relPath)) {
    total += PENALTIES.BUILD_OUTPUT;
  }
  // Single-colour masks: Apple's `Template` suffix, Safari's pinned-tab
  // silhouette, and the -mono/-symbolic conventions. All render as a black
  // blob in an <img>, so they rank below any real artwork.
  if (/(template|[-_](mono|symbolic))$/i.test(stem(relPath)) || /pinned-tab/i.test(stem(relPath))) {
    total += PENALTIES.MONOCHROME_HINT;
  }
  if (dirSegments.some(segment => SUPPORTING_ROLE_DIRS.includes(segment.toLowerCase()))) {
    total += PENALTIES.SUPPORTING_ROLE;
  }
  total += depth * PENALTIES.NESTED_APP;

  return total;
}

/**
 * Builds a scored candidate. `relPath` is relative to the project root and
 * `depth` counts app-nesting levels, so a nested app's own root icon is still
 * ranked below an equivalent icon at the top level.
 */
export function scoreCandidate(relPath: string, source: IconSource, depth = 0): IconCandidate {
  const path = toPosix(relPath);
  const score =
    SOURCE_WEIGHT[source] +
    nameWeight(path) +
    (EXT_WEIGHT[extname(path)] ?? 0) +
    dirWeight(path) +
    penalties(path, depth);

  return { path, score, source, depth };
}

/**
 * A total order over candidates. The trailing lexicographic comparison is the
 * point: without it the winner could depend on `fs.readdir` order, which is not
 * stable across filesystems, and a project's icon could change between rescans
 * with no change on disk.
 */
export function compareCandidates(a: IconCandidate, b: IconCandidate): number {
  if (a.score !== b.score) return b.score - a.score;

  const segmentDiff = segments(a.path).length - segments(b.path).length;
  if (segmentDiff !== 0) return segmentDiff;

  if (a.path.length !== b.path.length) return a.path.length - b.path.length;

  if (a.path === b.path) return 0;
  return a.path < b.path ? -1 : 1;
}

/** Sorts best-first and drops duplicate paths, keeping each path's best score. */
export function rankCandidates(candidates: IconCandidate[]): IconCandidate[] {
  const best = new Map<string, IconCandidate>();

  for (const candidate of candidates) {
    const existing = best.get(candidate.path);
    if (!existing || compareCandidates(candidate, existing) < 0) {
      best.set(candidate.path, candidate);
    }
  }

  return [...best.values()].sort(compareCandidates);
}
