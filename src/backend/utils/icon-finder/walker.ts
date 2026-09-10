/**
 * Bounded filesystem traversal for icon detection.
 *
 * Detection runs on every project save and rescan, across potentially hundreds
 * of projects, so every function here is explicitly capped. Directory entries
 * are read with `withFileTypes` -- one syscall tells us name and kind, with no
 * per-entry `stat`.
 */

import * as fs from 'fs/promises';
import type { Dirent } from 'fs';
import * as path from 'path';
import { IGNORED_DIRS, LIMITS, RENDERABLE_EXTENSIONS } from './definitions';
import { extname, toPosix } from './scoring';

/**
 * Reads a directory, sorted by name. The sort makes traversal order independent
 * of the filesystem's own ordering, which is not stable across platforms.
 */
export async function readDirSorted(dirPath: string): Promise<Dirent[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  } catch {
    // Missing, unreadable, or not a directory -- all mean "nothing here".
    return [];
  }
}

/** True when the entry is a file we could actually render in an <img>. */
export function isRenderableImage(entry: Dirent): boolean {
  return (
    entry.isFile() && (RENDERABLE_EXTENSIONS as readonly string[]).includes(extname(entry.name))
  );
}

/** Renderable image files directly inside `dirPath`, as names. */
export async function listImagesIn(dirPath: string): Promise<string[]> {
  return (await readDirSorted(dirPath)).filter(isRenderableImage).map(entry => entry.name);
}

/**
 * Breadth-first search for image files beneath `root`.
 *
 * Breadth-first rather than depth-first so that shallow files -- the ones most
 * likely to be the project's real icon -- are found first, which means the
 * directory budget truncates the least promising region of the tree.
 *
 * Symlinks are never followed: `isDirectory()` is false for them, so a
 * self-referential link cannot exhaust the budget or hang the walk.
 */
export async function collectImageFiles(
  root: string,
  options: { maxDepth?: number; maxDirs?: number; maxFiles?: number } = {}
): Promise<string[]> {
  const maxDepth = options.maxDepth ?? LIMITS.MAX_DEPTH;
  const maxDirs = options.maxDirs ?? LIMITS.MAX_DIRS_VISITED;
  const maxFiles = options.maxFiles ?? LIMITS.MAX_CANDIDATES;

  const found: string[] = [];
  const queue: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }];
  let dirsVisited = 0;

  while (queue.length > 0 && dirsVisited < maxDirs && found.length < maxFiles) {
    const { dir, depth } = queue.shift()!;
    dirsVisited += 1;

    for (const entry of await readDirSorted(dir)) {
      if (isRenderableImage(entry)) {
        found.push(toPosix(path.relative(root, path.join(dir, entry.name))));
        if (found.length >= maxFiles) break;
      } else if (
        entry.isDirectory() &&
        depth + 1 <= maxDepth &&
        !IGNORED_DIRS.has(entry.name.toLowerCase()) &&
        !entry.name.startsWith('.')
      ) {
        queue.push({ dir: path.join(dir, entry.name), depth: depth + 1 });
      }
    }
  }

  return found;
}

/** Runs `worker` over `items`, at most `limit` at a time. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  // Never zero runners: that would resolve instantly and silently return holes.
  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  });

  await Promise.all(runners);
  return results;
}
