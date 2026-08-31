import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createUnitTestContext, mockDatabaseForUnit } from '@test/contexts';
import {
  getGitCommonDir,
  isLinkedWorktree,
  parseWorktreeList,
  projectWorktreesService,
} from '@backend/services/project/project-worktrees-service';
import { db } from '@shared/database';
import { projects, projectWorktrees } from '@shared/database/schema';
import { eq } from 'drizzle-orm';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execFileAsync = promisify(execFile);

mockDatabaseForUnit();

describe('ProjectWorktreesService', () => {
  const context = createUnitTestContext();
  let tempDir: string;

  beforeEach(async () => {
    await context.setup();
    // macOS /var is a symlink to /private/var; git and the service both report
    // resolved paths, so resolve here to keep expectations comparable.
    tempDir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'worktree-test-')));
  });

  afterEach(async () => {
    await context.teardown();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  /** Creates a git repo with one commit. */
  async function makeRepo(name: string): Promise<string> {
    const repo = path.join(tempDir, name);
    await fs.mkdir(repo, { recursive: true });
    await execFileAsync('git', ['init', '-q'], { cwd: repo });
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: repo });
    await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: repo });
    await execFileAsync('git', ['commit', '-q', '--allow-empty', '-m', 'init'], { cwd: repo });
    return repo;
  }

  describe('parseWorktreeList', () => {
    it('parses a normal worktree and strips the refs/heads prefix', () => {
      const parsed = parseWorktreeList(
        ['worktree /repo/main', 'HEAD abc123', 'branch refs/heads/feat/nested-name', ''].join('\n')
      );

      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toMatchObject({
        path: '/repo/main',
        branch: 'feat/nested-name',
        isMain: true,
        detached: false,
      });
    });

    it('marks only the first entry as main', () => {
      const parsed = parseWorktreeList(
        [
          'worktree /repo/main',
          'HEAD aaa',
          'branch refs/heads/main',
          '',
          'worktree /repo/other',
          'HEAD bbb',
          'branch refs/heads/other',
          '',
        ].join('\n')
      );

      expect(parsed.map(w => w.isMain)).toEqual([true, false]);
    });

    it('reports a detached worktree with a null branch', () => {
      const parsed = parseWorktreeList(
        [
          'worktree /repo/main',
          'HEAD aaa',
          'branch refs/heads/main',
          '',
          'worktree /repo/detached',
          'HEAD bbb',
          'detached',
          '',
        ].join('\n')
      );

      expect(parsed[1]).toMatchObject({ branch: null, detached: true });
    });

    it('flags locked and prunable worktrees', () => {
      const parsed = parseWorktreeList(
        [
          'worktree /repo/main',
          'HEAD aaa',
          'branch refs/heads/main',
          '',
          'worktree /repo/locked',
          'HEAD bbb',
          'detached',
          'locked',
          '',
          'worktree /repo/gone',
          'HEAD ccc',
          'branch refs/heads/gone',
          'prunable gitdir file points to non-existent location',
          '',
        ].join('\n')
      );

      expect(parsed[1].locked).toBe(true);
      expect(parsed[2].prunable).toBe(true);
    });

    it('returns nothing for empty output', () => {
      expect(parseWorktreeList('')).toEqual([]);
    });
  });

  describe('getGitCommonDir / isLinkedWorktree', () => {
    it('groups a repo and its linked worktree under one common dir', async () => {
      const repo = await makeRepo('repo');
      const linked = path.join(tempDir, 'linked');
      await execFileAsync('git', ['worktree', 'add', '-q', '-b', 'feat', linked], { cwd: repo });

      const repoCommon = await getGitCommonDir(repo);
      const linkedCommon = await getGitCommonDir(linked);

      expect(repoCommon).not.toBeNull();
      expect(linkedCommon).toBe(repoCommon);
      // Absolute, not the bare relative '.git' that would be useless as a key
      expect(path.isAbsolute(repoCommon!)).toBe(true);
    });

    it('gives two independent clones of the same origin different common dirs', async () => {
      // The Forms / Ripform / Forms Copy case: same remote, separate object
      // stores, and they must stay separate projects.
      const origin = await makeRepo('origin');
      const cloneA = path.join(tempDir, 'clone-a');
      const cloneB = path.join(tempDir, 'clone-b');
      await execFileAsync('git', ['clone', '-q', origin, cloneA]);
      await execFileAsync('git', ['clone', '-q', origin, cloneB]);

      const commonA = await getGitCommonDir(cloneA);
      const commonB = await getGitCommonDir(cloneB);

      expect(commonA).not.toBeNull();
      expect(commonA).not.toBe(commonB);
      expect(await isLinkedWorktree(cloneA)).toBe(false);
      expect(await isLinkedWorktree(cloneB)).toBe(false);
    });

    it('identifies a linked worktree but not the main checkout', async () => {
      const repo = await makeRepo('repo');
      const linked = path.join(tempDir, 'linked');
      await execFileAsync('git', ['worktree', 'add', '-q', '-b', 'feat', linked], { cwd: repo });

      expect(await isLinkedWorktree(repo)).toBe(false);
      expect(await isLinkedWorktree(linked)).toBe(true);
    });

    it('returns null outside a git repository', async () => {
      const plain = path.join(tempDir, 'not-a-repo');
      await fs.mkdir(plain, { recursive: true });

      expect(await getGitCommonDir(plain)).toBeNull();
      expect(await isLinkedWorktree(plain)).toBe(false);
    });
  });

  describe('syncWorktrees', () => {
    async function seedProject(id: string, projectPath: string): Promise<void> {
      await db.insert(projects).values({ id, name: 'Test Project', path: projectPath });
    }

    it('records the main checkout and each linked worktree', async () => {
      const repo = await makeRepo('repo');
      const linked = path.join(tempDir, 'linked');
      await execFileAsync('git', ['worktree', 'add', '-q', '-b', 'feat', linked], { cwd: repo });
      await seedProject('p1', repo);

      const worktrees = await projectWorktreesService.syncWorktrees('p1', repo);

      expect(worktrees).toHaveLength(2);
      expect(worktrees[0]).toMatchObject({ path: repo, isMain: true });
      expect(worktrees.find(w => w.path === linked)).toMatchObject({
        branch: 'feat',
        isMain: false,
      });
    });

    it('skips prunable worktrees', async () => {
      const repo = await makeRepo('repo');
      const doomed = path.join(tempDir, 'doomed');
      await execFileAsync('git', ['worktree', 'add', '-q', '-b', 'gone', doomed], { cwd: repo });
      await fs.rm(doomed, { recursive: true, force: true });
      await seedProject('p1', repo);

      const worktrees = await projectWorktreesService.syncWorktrees('p1', repo);

      expect(worktrees.map(w => w.path)).toEqual([repo]);
    });

    it('removes worktrees git no longer reports', async () => {
      const repo = await makeRepo('repo');
      const linked = path.join(tempDir, 'linked');
      await execFileAsync('git', ['worktree', 'add', '-q', '-b', 'feat', linked], { cwd: repo });
      await seedProject('p1', repo);
      await projectWorktreesService.syncWorktrees('p1', repo);

      await execFileAsync('git', ['worktree', 'remove', '--force', linked], { cwd: repo });
      const worktrees = await projectWorktreesService.syncWorktrees('p1', repo);

      expect(worktrees.map(w => w.path)).toEqual([repo]);
    });

    it('preserves a user-set preferredIde across a resync', async () => {
      const repo = await makeRepo('repo');
      await seedProject('p1', repo);
      const [first] = await projectWorktreesService.syncWorktrees('p1', repo);
      await projectWorktreesService.setPreferredIde(first.id, 'intellij');

      const worktrees = await projectWorktreesService.syncWorktrees('p1', repo);

      expect(worktrees[0].preferredIde).toBe('intellij');
      expect(worktrees[0].id).toBe(first.id);
    });

    it('leaves existing rows alone when git fails', async () => {
      const repo = await makeRepo('repo');
      await seedProject('p1', repo);
      await projectWorktreesService.syncWorktrees('p1', repo);

      const plain = path.join(tempDir, 'not-a-repo');
      await fs.mkdir(plain, { recursive: true });
      const worktrees = await projectWorktreesService.syncWorktrees('p1', plain);

      // A transient git failure must not wipe known worktrees
      expect(worktrees).toHaveLength(1);
    });

    it('records dirty state and last commit per worktree', async () => {
      const repo = await makeRepo('repo');
      const linked = path.join(tempDir, 'linked');
      await execFileAsync('git', ['worktree', 'add', '-q', '-b', 'feat', linked], { cwd: repo });

      // Give the linked worktree its own commit and its own dirty file, so a
      // repo-level answer would be visibly wrong for it.
      await fs.writeFile(path.join(linked, 'only-here.txt'), 'hello');
      await execFileAsync('git', ['add', 'only-here.txt'], { cwd: linked });
      await execFileAsync('git', ['commit', '-q', '-m', 'commit on the worktree'], { cwd: linked });
      await fs.writeFile(path.join(linked, 'dirty.txt'), 'uncommitted');

      await seedProject('p1', repo);
      const worktrees = await projectWorktreesService.syncWorktrees('p1', repo);

      const main = worktrees.find(w => w.path === repo);
      const feature = worktrees.find(w => w.path === linked);

      expect(feature?.lastCommitMessage).toBe('commit on the worktree');
      expect(feature?.hasUncommittedChanges).toBe(true);
      // the main checkout is clean and still on its own commit
      expect(main?.lastCommitMessage).toBe('init');
      expect(main?.hasUncommittedChanges).toBe(false);
    });

    it('claims a worktree path held by another project', async () => {
      // The collapse case: the sibling worktree was scanned as its own project
      // before we knew it was a worktree, so its path already has a row. `path`
      // is globally unique, so sync must re-point that row rather than collide.
      const repo = await makeRepo('repo');
      const linked = path.join(tempDir, 'linked');
      await execFileAsync('git', ['worktree', 'add', '-q', '-b', 'feat', linked], { cwd: repo });

      await seedProject('p1', repo);
      await seedProject('p2', linked);
      await db.insert(projectWorktrees).values({
        projectId: 'p2',
        path: linked,
        branch: 'feat',
        isMain: true,
      });

      const worktrees = await projectWorktreesService.syncWorktrees('p1', repo);

      expect(worktrees.map(w => w.path).sort()).toEqual([repo, linked].sort());
      // and p2 no longer owns it
      const p2Rows = await db
        .select()
        .from(projectWorktrees)
        .where(eq(projectWorktrees.projectId, 'p2'));
      expect(p2Rows).toEqual([]);
    });

    it('deletes a standalone project row that is really a worktree', async () => {
      // The original bug: the sibling worktree was stored as its own project,
      // double-counting the repo. Syncing the real project must collapse it --
      // and must not lose the worktree row to the delete's cascade.
      const repo = await makeRepo('repo');
      const linked = path.join(tempDir, 'linked');
      await execFileAsync('git', ['worktree', 'add', '-q', '-b', 'feat', linked], { cwd: repo });

      await seedProject('p1', repo);
      await seedProject('p2', linked);

      const worktrees = await projectWorktreesService.syncWorktrees('p1', repo);

      const remainingProjects = await db.select().from(projects);
      expect(remainingProjects.map(p => p.id)).toEqual(['p1']);
      // the worktree survived the cascade because it was re-pointed first
      expect(worktrees.map(w => w.path).sort()).toEqual([repo, linked].sort());
    });

    it('never deletes the project being synced', async () => {
      const repo = await makeRepo('repo');
      await seedProject('p1', repo);

      await projectWorktreesService.syncWorktrees('p1', repo);

      expect((await db.select().from(projects)).map(p => p.id)).toEqual(['p1']);
    });


    it('does not delete itself when synced from a linked worktree path', async () => {
      // A project row can sit at a linked worktree's path (it was scanned before
      // we could tell). Syncing THAT project reports its own path as a non-main
      // entry, which the collapse loop would otherwise delete -- taking the row
      // being synced, and its worktrees, with it.
      const repo = await makeRepo('repo');
      const linked = path.join(tempDir, 'linked');
      await execFileAsync('git', ['worktree', 'add', '-q', '-b', 'feat', linked], { cwd: repo });

      await seedProject('p-linked', linked);

      const worktrees = await projectWorktreesService.syncWorktrees('p-linked', linked);

      expect((await db.select().from(projects)).map(p => p.id)).toEqual(['p-linked']);
      expect(worktrees.length).toBeGreaterThan(0);
    });

    it('cascades worktree rows when the project is deleted', async () => {
      const repo = await makeRepo('repo');
      await seedProject('p1', repo);
      await projectWorktreesService.syncWorktrees('p1', repo);

      await db.delete(projects).where(eq(projects.id, 'p1'));
      const remaining = await db
        .select()
        .from(projectWorktrees)
        .where(eq(projectWorktrees.projectId, 'p1'));

      expect(remaining).toEqual([]);
    });
  });
});
