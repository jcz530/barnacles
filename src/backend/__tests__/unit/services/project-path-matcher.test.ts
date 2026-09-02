import { describe, expect, it } from 'vitest';
import { matchPathToCandidate } from '@backend/services/project/project-path-matcher';

const PROJECT = { projectId: 'proj-1', path: '/Users/dev/Development/harbor-api' };

describe('matchPathToCandidate', () => {
  it('matches a path against the project root itself', () => {
    expect(matchPathToCandidate(PROJECT.path, [PROJECT])).toBe(PROJECT);
  });

  it('compares candidates by normalized length, ignoring trailing separators', () => {
    // Regression guard: comparing a normalized candidate against an un-normalized
    // incumbent lets trailing slashes inflate the incumbent's length, so a
    // shorter, less specific path wins and shadows the real match.
    const padded = { projectId: 'proj-1', path: '/a/b/c///' };
    const deeper = { projectId: 'proj-2', path: '/a/b/c/d' };

    expect(matchPathToCandidate('/a/b/c/d/e', [padded, deeper])?.projectId).toBe('proj-2');
  });

  it('matches a path nested inside the project', () => {
    const match = matchPathToCandidate(`${PROJECT.path}/src/backend`, [PROJECT]);
    expect(match?.projectId).toBe('proj-1');
  });

  it('ignores trailing separators on either side', () => {
    const match = matchPathToCandidate(`${PROJECT.path}/`, [
      { projectId: 'proj-1', path: `${PROJECT.path}/` },
    ]);
    expect(match?.projectId).toBe('proj-1');
  });

  it('does not match a sibling that merely shares a name prefix', () => {
    // '/…/harbor' must not swallow '/…/harbor-api'.
    const sibling = { projectId: 'proj-2', path: '/Users/dev/Development/harbor' };
    expect(matchPathToCandidate(PROJECT.path, [sibling])).toBeNull();
  });

  it('prefers the longest match so a nested worktree beats its parent', () => {
    const worktree = { projectId: 'proj-2', path: `${PROJECT.path}/worktrees/feature` };
    const match = matchPathToCandidate(`${worktree.path}/src`, [PROJECT, worktree]);
    expect(match?.projectId).toBe('proj-2');
  });

  it('is order-independent when candidates overlap', () => {
    const worktree = { projectId: 'proj-2', path: `${PROJECT.path}/worktrees/feature` };
    const match = matchPathToCandidate(`${worktree.path}/src`, [worktree, PROJECT]);
    expect(match?.projectId).toBe('proj-2');
  });

  it('returns null when nothing contains the path', () => {
    expect(matchPathToCandidate('/tmp/elsewhere', [PROJECT])).toBeNull();
  });

  it('returns null when there are no candidates', () => {
    expect(matchPathToCandidate(PROJECT.path, [])).toBeNull();
  });

  it('matches Windows-style nested paths', () => {
    const windows = { projectId: 'proj-3', path: 'C:\\dev\\harbor-api' };
    const match = matchPathToCandidate('C:\\dev\\harbor-api\\src', [windows]);
    expect(match?.projectId).toBe('proj-3');
  });
});
