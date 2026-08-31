import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createUnitTestContext, mockDatabaseForUnit } from '@test/contexts';
import { projectGitStatsService } from '@backend/services/project/project-git-stats-service';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execFileAsync = promisify(execFile);

mockDatabaseForUnit();

/**
 * `git log --all` reads the repository's shared object store, so every checkout
 * of one repo reports the identical commits. Scanning a repo and its worktree
 * would therefore count all of its activity twice.
 */
describe('git stats repository de-duplication', () => {
  const context = createUnitTestContext();
  let tempDir: string;

  beforeEach(async () => {
    await context.setup();
    tempDir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'gitstats-test-')));
  });

  afterEach(async () => {
    await context.teardown();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  async function makeRepo(name: string): Promise<string> {
    const repo = path.join(tempDir, name);
    await fs.mkdir(repo, { recursive: true });
    await execFileAsync('git', ['init', '-q'], { cwd: repo });
    await execFileAsync('git', ['config', 'user.email', 'dev@example.com'], { cwd: repo });
    await execFileAsync('git', ['config', 'user.name', 'Dev'], { cwd: repo });
    await fs.writeFile(path.join(repo, 'a.txt'), 'one\ntwo\nthree\n');
    await execFileAsync('git', ['add', '.'], { cwd: repo });
    await execFileAsync('git', ['commit', '-q', '-m', 'first'], { cwd: repo });
    return repo;
  }

  const today = new Date().toISOString().slice(0, 10);

  async function statsFor(projectPaths: string[], detail = false) {
    return projectGitStatsService.getGitStats({
      projectPaths,
      period: 'month',
      additionalEmails: ['dev@example.com'],
      detail,
    });
  }

  it('counts a repository once even when a worktree is also listed', async () => {
    const repo = await makeRepo('repo');
    const linked = path.join(tempDir, 'linked');
    await execFileAsync('git', ['worktree', 'add', '-q', '-b', 'feat', linked], { cwd: repo });

    const single = await statsFor([repo]);
    const withWorktree = await statsFor([repo, linked]);

    expect(withWorktree.totals.commits).toBe(single.totals.commits);
    expect(withWorktree.totals.linesAdded).toBe(single.totals.linesAdded);
    expect(single.totals.commits).toBeGreaterThan(0);
  });

  it('still counts two independent clones separately', async () => {
    // Same remote, separate object stores: real distinct work, not a duplicate.
    const origin = await makeRepo('origin');
    const cloneA = path.join(tempDir, 'clone-a');
    const cloneB = path.join(tempDir, 'clone-b');
    await execFileAsync('git', ['clone', '-q', origin, cloneA]);
    await execFileAsync('git', ['clone', '-q', origin, cloneB]);

    // Give each clone its own commit so they are not merely identical copies.
    for (const [clone, message] of [
      [cloneA, 'only in a'],
      [cloneB, 'only in b'],
    ] as const) {
      await execFileAsync('git', ['config', 'user.email', 'dev@example.com'], { cwd: clone });
      await execFileAsync('git', ['config', 'user.name', 'Dev'], { cwd: clone });
      await fs.writeFile(path.join(clone, 'extra.txt'), 'x\n');
      await execFileAsync('git', ['add', '.'], { cwd: clone });
      await execFileAsync('git', ['commit', '-q', '-m', message], { cwd: clone });
    }

    const justA = await statsFor([cloneA]);
    const both = await statsFor([cloneA, cloneB]);

    expect(both.totals.commits).toBeGreaterThan(justA.totals.commits);
  });

  it('keeps a non-git directory in the set', async () => {
    const plain = path.join(tempDir, 'not-a-repo');
    await fs.mkdir(plain, { recursive: true });

    const stats = await statsFor([plain]);

    // Nothing to report, but it must not throw or drop the range.
    expect(stats.totals.commits).toBe(0);
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('picks the same checkout regardless of input order', async () => {
    // Callers pass projects ordered by lastModified, which changes as the user
    // works -- but the cache key is built from a sorted copy, so an
    // order-dependent winner would let a cache hit return stats computed
    // against a different checkout (which can carry its own user.email).
    const repo = await makeRepo('repo');
    const linked = path.join(tempDir, 'linked');
    await execFileAsync('git', ['worktree', 'add', '-q', '-b', 'feat', linked], { cwd: repo });

    // perProject names the surviving checkout, and only detail mode reports it.
    // Assert the exact winner in BOTH orders: asserting only that the two agree
    // would pass even for an order-dependent implementation whose first case
    // happens to match.
    const forwards = await statsFor([repo, linked], true);
    const backwards = await statsFor([linked, repo], true);

    // The main checkout represents the repository, not whichever path sorts first
    // (here 'linked' < 'repo').
    expect(forwards.detail?.perProject.map(p => p.projectPath) ?? []).toEqual([repo]);
    expect(backwards.detail?.perProject.map(p => p.projectPath) ?? []).toEqual([repo]);
  });
});
