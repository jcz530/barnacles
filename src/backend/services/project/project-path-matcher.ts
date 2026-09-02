/**
 * Longest-prefix matching of a filesystem path to a project.
 *
 * Shared so `getProjectByPath` (one path, one lookup) and event listing (many
 * paths, one candidate set) agree on what "this path belongs to that project"
 * means — in particular the worktree handling, which is easy to leave out.
 */

/** A project root, or one of its worktrees, as a matchable path. */
export interface PathCandidate {
  projectId: string;
  path: string;
}

/** Trailing separators would break the prefix comparison below. */
function normalize(path: string): string {
  return path.replace(/[/\\]+$/, '');
}

/**
 * Find the candidate that best contains `path`.
 *
 * A containing directory wins over a shorter one so a worktree nested inside a
 * project root resolves to the worktree rather than the parent. Matching is on
 * a separator boundary, so `/foo/bar-baz` is not treated as inside `/foo/bar`.
 */
export function matchPathToCandidate(
  path: string,
  candidates: PathCandidate[]
): PathCandidate | null {
  const normalizedPath = normalize(path);

  let bestMatch: PathCandidate | null = null;
  // Tracked alongside the match so the comparison can never regress to using a
  // raw, un-normalized length — trailing separators would inflate the incumbent
  // and let a shorter, less specific candidate shadow the real match.
  let bestLength = -1;

  for (const candidate of candidates) {
    const candidatePath = normalize(candidate.path);

    const isMatch =
      normalizedPath === candidatePath ||
      normalizedPath.startsWith(candidatePath + '/') ||
      normalizedPath.startsWith(candidatePath + '\\');

    if (isMatch && candidatePath.length > bestLength) {
      bestMatch = candidate;
      bestLength = candidatePath.length;
    }
  }

  return bestMatch;
}
