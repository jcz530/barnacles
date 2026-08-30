import { execFile } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { db } from '../../../shared/database';
import { projects, projectWorktrees } from '../../../shared/database/schema';

const execFileAsync = promisify(execFile);

// Matches the scanner's git exec hardening: an argv array is never shell-parsed,
// a large `git status` cannot overflow the 1MB default buffer, and a wedged git
// call (stale index.lock, unresponsive network mount) cannot hang the scan.
const GIT_MAX_BUFFER = 32 * 1024 * 1024;
const GIT_TIMEOUT_MS = 30_000;

// Single source of truth, shared with the frontend. Declaring a second copy here
// is how ProjectStats ended up with two interfaces that disagree.
export type { Worktree } from '../../../shared/types/api';
import type { Worktree } from '../../../shared/types/api';

/** One entry of `git worktree list --porcelain`. */
export interface ParsedWorktree {
  path: string;
  branch: string | null;
  isMain: boolean;
  detached: boolean;
  locked: boolean;
  prunable: boolean;
}

/**
 * Resolves symlinks so a worktree path can be compared against a project path.
 *
 * git reports fully resolved paths (`/private/var/...` on macOS) while a scanned
 * project path may still contain a symlinked prefix (`/var/...`). The scanner's
 * own dedup keys on realpath, so normalising here keeps the two joinable.
 * Falls back to the original path when it cannot be resolved.
 */
async function normalizePath(candidate: string): Promise<string> {
  try {
    return await fs.realpath(candidate);
  } catch {
    return candidate;
  }
}

/**
 * Parses `git worktree list --porcelain`.
 *
 * Entries are blank-line separated. Each line is either `key value` or a bare
 * flag (`detached`, `locked`, `prunable`). The first entry is always the main
 * worktree. Exported for testing.
 */
export function parseWorktreeList(stdout: string): ParsedWorktree[] {
  const blocks = stdout.trim().split(/\n\s*\n/);
  const worktrees: ParsedWorktree[] = [];

  for (const block of blocks) {
    if (!block.trim()) {
      continue;
    }

    let worktreePath: string | undefined;
    let branch: string | null = null;
    let detached = false;
    let locked = false;
    let prunable = false;

    for (const line of block.split('\n')) {
      const separator = line.indexOf(' ');
      const key = separator === -1 ? line : line.slice(0, separator);
      const value = separator === -1 ? '' : line.slice(separator + 1);

      switch (key) {
        case 'worktree':
          worktreePath = value;
          break;
        case 'branch':
          // `refs/heads/feat/x` -> `feat/x`
          branch = value.replace(/^refs\/heads\//, '');
          break;
        case 'detached':
          detached = true;
          break;
        case 'locked':
          locked = true;
          break;
        case 'prunable':
          prunable = true;
          break;
      }
    }

    if (!worktreePath) {
      continue;
    }

    worktrees.push({
      path: worktreePath,
      branch,
      isMain: worktrees.length === 0,
      detached,
      locked,
      prunable,
    });
  }

  return worktrees;
}

/** Dirty state and last commit for a single checkout. */
export interface WorktreeGitState {
  hasUncommittedChanges: boolean | null;
  lastCommitDate: Date | null;
  lastCommitMessage: string | null;
}

/**
 * Reads dirty state and last commit for one checkout.
 *
 * Each worktree has its own working tree and its own HEAD, so this has to run
 * per path -- the repository-level answer is only correct for the main checkout.
 * Returns nulls rather than throwing so one bad worktree cannot fail a sync.
 */
async function readWorktreeGitState(worktreePath: string): Promise<WorktreeGitState> {
  const options = { cwd: worktreePath, maxBuffer: GIT_MAX_BUFFER, timeout: GIT_TIMEOUT_MS };
  const state: WorktreeGitState = {
    hasUncommittedChanges: null,
    lastCommitDate: null,
    lastCommitMessage: null,
  };

  try {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain'], options);
    state.hasUncommittedChanges = stdout.trim().length > 0;
  } catch {
    // Leave null; the worktree directory may be gone or unreadable.
  }

  try {
    const { stdout } = await execFileAsync('git', ['log', '-1', '--format=%cI%x00%s'], options);
    const [commitDate, commitMessage] = stdout.split('\0');
    if (commitDate?.trim()) {
      state.lastCommitDate = new Date(commitDate.trim());
    }
    state.lastCommitMessage = commitMessage?.trim() || null;
  } catch {
    // No commits yet.
  }

  return state;
}

/**
 * Absolute path to the repository's shared git directory, which is the identity
 * of a repository: every worktree of the same repo resolves to the same value.
 *
 * `--path-format=absolute` is required -- without it a main worktree returns the
 * relative `.git`, which is useless as a grouping key. The flag needs git >= 2.31,
 * so fall back to resolving the relative answer against the directory itself.
 *
 * Returns null when the path is not inside a git repository.
 */
export async function getGitCommonDir(dirPath: string): Promise<string | null> {
  const options = { cwd: dirPath, maxBuffer: GIT_MAX_BUFFER, timeout: GIT_TIMEOUT_MS };

  try {
    const { stdout } = await execFileAsync(
      'git',
      ['rev-parse', '--path-format=absolute', '--git-common-dir'],
      options
    );
    const resolved = stdout.trim();
    if (resolved) {
      return resolved;
    }
  } catch {
    // Older git without --path-format; fall through.
  }

  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--git-common-dir'], options);
    const resolved = stdout.trim();
    if (!resolved) {
      return null;
    }
    return path.isAbsolute(resolved) ? resolved : path.resolve(dirPath, resolved);
  } catch {
    return null;
  }
}

/**
 * True when dirPath is a linked worktree rather than a repository's main
 * checkout -- i.e. its shared git dir lives somewhere other than `<dirPath>/.git`.
 *
 * This is the identity test, deliberately not the remote URL: two independent
 * clones of the same remote have separate object stores and are separate
 * projects, while worktrees of one repo share one.
 */
export async function isLinkedWorktree(dirPath: string): Promise<boolean> {
  const commonDir = await getGitCommonDir(dirPath);
  if (!commonDir) {
    return false;
  }

  // Both sides go through realpath: git reports resolved paths, while dirPath
  // may still carry a symlinked prefix.
  const resolvedCommon = await normalizePath(commonDir);
  const ownGitDir = await normalizePath(path.join(dirPath, '.git'));

  return resolvedCommon !== ownGitDir;
}

class ProjectWorktreesService {
  /**
   * Get all worktrees for a project, main checkout first.
   */
  async getWorktrees(projectId: string): Promise<Worktree[]> {
    const worktrees = await db
      .select()
      .from(projectWorktrees)
      .where(eq(projectWorktrees.projectId, projectId))
      .orderBy(projectWorktrees.createdAt);

    return worktrees.sort((a, b) => Number(b.isMain) - Number(a.isMain));
  }

  /**
   * List the worktrees git reports for a repository.
   *
   * Prunable entries are skipped: their directory is gone, and registering one
   * would reintroduce the stale-row problem in a new place.
   */
  async listWorktreesFromGit(repoPath: string): Promise<ParsedWorktree[]> {
    try {
      const { stdout } = await execFileAsync('git', ['worktree', 'list', '--porcelain'], {
        cwd: repoPath,
        maxBuffer: GIT_MAX_BUFFER,
        timeout: GIT_TIMEOUT_MS,
      });
      const parsed = parseWorktreeList(stdout).filter(worktree => !worktree.prunable);

      return Promise.all(
        parsed.map(async worktree => ({
          ...worktree,
          path: await normalizePath(worktree.path),
        }))
      );
    } catch {
      return [];
    }
  }

  /**
   * Replace a project's worktree rows with what git currently reports.
   *
   * Rows are keyed on path, so an existing row is updated rather than recreated
   * and its user-set fields (preferredIde) survive. Worktrees git no longer
   * reports are removed.
   */
  async syncWorktrees(
    projectId: string,
    repoPath: string,
    /**
     * Git state for `repoPath` itself, when the caller already collected it
     * (the scanner does). Applied to whichever worktree matches that path;
     * other worktrees keep whatever they already had.
     */
    gitInfoForRepoPath?: {
      hasUncommittedChanges?: boolean;
      lastCommitDate?: Date;
      lastCommitMessage?: string;
    }
  ): Promise<Worktree[]> {
    const fromGit = await this.listWorktreesFromGit(repoPath);
    const normalizedRepoPath = await normalizePath(repoPath);

    if (fromGit.length === 0) {
      // Not a git repo, or git failed. Leave any existing rows alone rather than
      // deleting them on a transient failure.
      return this.getWorktrees(projectId);
    }

    // Look at every worktree row, not just this project's. `path` is globally
    // unique, and a path can legitimately be claimed by a different project:
    // either it was scanned as a standalone project before we knew it was a
    // worktree, or another repo's git metadata still lists it. Git is the
    // authority for who owns a path, so re-point those rows to this project
    // rather than colliding on the unique index.
    const allRows = await db.select().from(projectWorktrees);
    const existing = allRows.filter(row => row.projectId === projectId);
    const rowByPath = new Map(allRows.map(row => [row.path, row]));
    const seen = new Set<string>();

    // Each checkout has its own working tree and HEAD, so branch alone is not
    // enough -- read dirty state and last commit per worktree. Repos have a
    // handful of worktrees at most, so reading them together is cheap.
    const gitStateByPath = new Map<string, WorktreeGitState>(
      await Promise.all(
        fromGit
          .filter(worktree => worktree.path !== normalizedRepoPath || !gitInfoForRepoPath)
          .map(
            async worktree => [worktree.path, await readWorktreeGitState(worktree.path)] as const
          )
      )
    );

    for (const worktree of fromGit) {
      seen.add(worktree.path);
      const previous = rowByPath.get(worktree.path);

      // Prefer git state the caller already collected for the scanned path;
      // every other checkout was read directly above.
      const gitState =
        worktree.path === normalizedRepoPath && gitInfoForRepoPath
          ? {
              hasUncommittedChanges: gitInfoForRepoPath.hasUncommittedChanges ?? null,
              lastCommitDate: gitInfoForRepoPath.lastCommitDate ?? null,
              lastCommitMessage: gitInfoForRepoPath.lastCommitMessage ?? null,
            }
          : (gitStateByPath.get(worktree.path) ?? {});

      if (previous) {
        await db
          .update(projectWorktrees)
          .set({
            // Claim the row if another project held this path.
            projectId,
            branch: worktree.branch,
            isMain: worktree.isMain,
            ...gitState,
            updatedAt: new Date(),
          })
          .where(eq(projectWorktrees.id, previous.id));
      } else {
        await db.insert(projectWorktrees).values({
          id: createId(),
          projectId,
          path: worktree.path,
          branch: worktree.branch,
          isMain: worktree.isMain,
          ...gitState,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    for (const row of existing) {
      if (!seen.has(row.path)) {
        await db.delete(projectWorktrees).where(eq(projectWorktrees.id, row.id));
      }
    }

    // Collapse any standalone project row that is really one of these worktrees.
    // Such rows exist because the directory was scanned as a project before we
    // could tell it was a worktree; the scanner skips it now, so nothing else
    // would ever clean it up. Deleting cascades its stats and technologies,
    // which were duplicates of this project's.
    for (const worktree of fromGit) {
      if (worktree.isMain) {
        continue;
      }

      const duplicates = await db.select().from(projects).where(eq(projects.path, worktree.path));

      for (const duplicate of duplicates) {
        if (duplicate.id !== projectId) {
          await db.delete(projects).where(eq(projects.id, duplicate.id));
        }
      }
    }

    return this.getWorktrees(projectId);
  }

  /**
   * Update the preferred IDE for a single worktree.
   */
  async setPreferredIde(
    worktreeId: string,
    preferredIde: string | null
  ): Promise<{ success: boolean; error?: string }> {
    const existing = await db
      .select()
      .from(projectWorktrees)
      .where(eq(projectWorktrees.id, worktreeId))
      .limit(1);

    if (existing.length === 0) {
      return { success: false, error: 'Worktree not found' };
    }

    await db
      .update(projectWorktrees)
      .set({ preferredIde, updatedAt: new Date() })
      .where(eq(projectWorktrees.id, worktreeId));

    return { success: true };
  }
}

export const projectWorktreesService = new ProjectWorktreesService();
