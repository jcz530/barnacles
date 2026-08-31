import type { ProjectWithDetails, Worktree } from '../../shared/types/api';

/**
 * The project's main checkout.
 *
 * Branch and dirty state are per-worktree, but list views (the project grid,
 * the table, the tray) show one line per project -- and the repository's "current"
 * state is its main checkout. Falls back to the first worktree if none is
 * flagged, which can happen mid-scan before git has been read.
 */
export function getMainWorktree(project: ProjectWithDetails): Worktree | undefined {
  const worktrees = project.worktrees ?? [];
  return worktrees.find(worktree => worktree.isMain) ?? worktrees[0];
}

/** Branch of the project's main checkout, or null when detached or untracked. */
export function getMainBranch(project: ProjectWithDetails): string | null {
  return getMainWorktree(project)?.branch ?? null;
}

/** Whether the project's main checkout has uncommitted changes. */
export function hasMainWorktreeChanges(project: ProjectWithDetails): boolean {
  return getMainWorktree(project)?.hasUncommittedChanges === true;
}
