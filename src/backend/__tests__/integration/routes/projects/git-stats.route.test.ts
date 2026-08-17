import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createIntegrationTestContext, mockDatabaseForIntegration } from '@test/contexts';
import { get } from '@test/helpers/api-client';
import { setupProjectRoutes } from '@test/helpers/route-test-setup';
import { createProjectData } from '@test/factories/project.factory';
import { projects as projectsSchema } from '@shared/database/schema';
import type { GitStats } from '@shared/types/api';

mockDatabaseForIntegration();

/**
 * Recorded execFile invocations, so tests can assert on how git was called —
 * the argv array is itself part of the contract (no shell interpolation, and
 * an end-of-day --until bound).
 */
let execCalls: Array<{ file: string; args: string[]; options: { cwd?: string } }> = [];

/**
 * Mutable per-test handler. Vitest hoists vi.mock() and keeps only the last
 * factory for a module path, so all child_process mocking flows through this
 * single indirection. Returns stdout for a given cwd.
 */
let gitLogHandler: (cwd: string | undefined, args: string[]) => string;

vi.mock('child_process', async importOriginal => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    execFile: vi.fn(
      (
        file: string,
        args: string[],
        options: { cwd?: string },
        callback: (err: Error | null, result?: { stdout: string; stderr: string }) => void
      ) => {
        execCalls.push({ file, args, options: options ?? {} });

        // `git config` lookups resolve the author email; only `git log` output
        // is under test.
        if (args[0] === 'config') {
          callback(null, { stdout: 'dev@example.com', stderr: '' });
          return;
        }

        callback(null, { stdout: gitLogHandler(options?.cwd, args), stderr: '' });
      }
    ),
  };
});

// Every seeded project should look like a real repository.
vi.mock('fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('fs/promises')>();
  return { ...actual, default: { ...actual, access: vi.fn().mockResolvedValue(undefined) } };
});

/** Build `git log --numstat` output from commits. */
function gitLog(commits: Array<{ date: string; files: Array<[number, number, string]> }>): string {
  return commits
    .map(
      (commit, index) =>
        `${commit.date}|hash${index}\n` +
        commit.files.map(([added, removed, file]) => `${added}\t${removed}\t${file}`).join('\n')
    )
    .join('\n');
}

async function seedProject(db: any, overrides: Record<string, unknown> = {}) {
  const [project] = await db
    .insert(projectsSchema)
    .values(createProjectData({ archivedAt: null, ...overrides } as any))
    .returning();
  return project;
}

function body(response: { data: unknown }): GitStats {
  return (response.data as { data: GitStats }).data;
}

describe('Git Stats API Integration Tests', () => {
  const context = createIntegrationTestContext();

  beforeEach(async () => {
    execCalls = [];
    gitLogHandler = () => '';
    await setupProjectRoutes(context);

    // The service caches results; each test seeds its own data and must not
    // read another test's.
    const { projectGitStatsService } = await import(
      '@backend/services/project/project-git-stats-service'
    );
    projectGitStatsService.clearCache();
  });

  afterEach(async () => {
    await context.teardown();
    vi.clearAllMocks();
  });

  describe('period requests (dashboard)', () => {
    it('defaults to the current week', async () => {
      const { app } = context.get();
      const response = await get(app, '/api/projects/git-stats');

      expect(response.status).toBe(200);
      expect(body(response).period).toBe('week');
      expect(body(response).days).toHaveLength(7);
    });

    it('falls back to week for an unrecognised period', async () => {
      const { app } = context.get();
      const response = await get(app, '/api/projects/git-stats?period=decade');

      expect(response.status).toBe(200);
      expect(body(response).period).toBe('week');
    });

    it('omits the detail block unless it is requested', async () => {
      const { app } = context.get();
      const response = await get(app, '/api/projects/git-stats?period=week');

      expect(body(response).detail).toBeUndefined();
    });
  });

  describe('month requests', () => {
    it('returns every day of the requested month', async () => {
      const { app } = context.get();
      const response = await get(app, '/api/projects/git-stats?month=2024-03');

      expect(response.status).toBe(200);
      const stats = body(response);
      expect(stats.period).toBe('custom-month');
      expect(stats.days).toHaveLength(31);
      expect(stats.days[0].date).toBe('2024-03-01');
      expect(stats.days[30].date).toBe('2024-03-31');
      expect(stats.range).toMatchObject({ since: '2024-03-01', month: '2024-03' });
    });

    it('covers a leap February', async () => {
      const { app } = context.get();
      const response = await get(app, '/api/projects/git-stats?month=2024-02');
      expect(body(response).days).toHaveLength(29);
    });

    it('rejects a malformed month', async () => {
      const { app } = context.get();

      for (const month of ['2024-13', 'nonsense', '2024-1', '24-01']) {
        const response = await get(app, `/api/projects/git-stats?month=${month}`);
        expect(response.status, `month=${month}`).toBe(400);
      }
    });

    it('rejects a future month', async () => {
      const { app } = context.get();
      const response = await get(app, '/api/projects/git-stats?month=2099-01');

      expect(response.status).toBe(400);
      expect((response.data as any).code).toBe('FUTURE_MONTH');
    });

    it('rejects an unknown projectId', async () => {
      const { app } = context.get();
      const response = await get(app, '/api/projects/git-stats?month=2024-03&projectId=nope');

      expect(response.status).toBe(400);
      expect((response.data as any).code).toBe('UNKNOWN_PROJECT');
    });
  });

  describe('git invocation contract', () => {
    it('bounds --until to the end of the day so the last day is counted', async () => {
      const { db, app } = context.get();
      await seedProject(db, { path: '/repos/alpha' });

      gitLogHandler = () => gitLog([{ date: '2024-03-31', files: [[10, 2, 'src/index.ts']] }]);

      const response = await get(app, '/api/projects/git-stats?month=2024-03');

      const logCall = execCalls.find(call => call.args[0] === 'log');
      expect(logCall?.args).toContain('--until=2024-03-31T23:59:59');

      // A commit on the final day must survive into the totals.
      expect(body(response).totals.commits).toBe(1);
      expect(body(response).days[30].commits).toBe(1);
    });

    it('passes author emails as argv, never as a shell string', async () => {
      const { db, app } = context.get();
      await seedProject(db, { path: '/repos/alpha' });

      await get(app, '/api/projects/git-stats?month=2024-03');

      const logCall = execCalls.find(call => call.args[0] === 'log');
      expect(logCall?.file).toBe('git');
      // An argv array is never parsed by a shell, so metacharacters in an email
      // stay inert. Each --author is one intact element.
      expect(Array.isArray(logCall?.args)).toBe(true);
      const authors = logCall!.args.filter(arg => arg.startsWith('--author='));
      expect(authors).toContain('--author=dev@example.com');
      expect(logCall!.args.join(' ')).not.toContain('"');
    });
  });

  describe('aggregation', () => {
    it('counts a file edited on several days once in the totals', async () => {
      const { db, app } = context.get();
      await seedProject(db, { path: '/repos/alpha' });

      gitLogHandler = () =>
        gitLog([
          { date: '2024-03-04', files: [[5, 1, 'src/shared.ts']] },
          { date: '2024-03-05', files: [[3, 2, 'src/shared.ts']] },
        ]);

      const stats = body(await get(app, '/api/projects/git-stats?month=2024-03'));

      // The period total is distinct files, not the sum of the daily counts.
      expect(stats.totals.filesChanged).toBe(1);
      expect(stats.days.find(d => d.date === '2024-03-04')?.filesChanged).toBe(1);
      expect(stats.days.find(d => d.date === '2024-03-05')?.filesChanged).toBe(1);
    });

    it('derives churn, net lines and active days', async () => {
      const { db, app } = context.get();
      await seedProject(db, { path: '/repos/alpha' });

      gitLogHandler = () =>
        gitLog([
          { date: '2024-03-04', files: [[10, 4, 'a.ts']] },
          { date: '2024-03-06', files: [[5, 1, 'b.ts']] },
        ]);

      const totals = body(await get(app, '/api/projects/git-stats?month=2024-03')).totals;

      expect(totals.linesAdded).toBe(15);
      expect(totals.linesRemoved).toBe(5);
      expect(totals.netLines).toBe(10);
      expect(totals.churn).toBe(20);
      expect(totals.activeDays).toBe(2);
    });

    it('excludes lockfiles from line counts', async () => {
      const { db, app } = context.get();
      await seedProject(db, { path: '/repos/alpha' });

      gitLogHandler = () =>
        gitLog([
          {
            date: '2024-03-04',
            files: [
              [5000, 4000, 'package-lock.json'],
              [10, 2, 'src/index.ts'],
            ],
          },
        ]);

      const totals = body(await get(app, '/api/projects/git-stats?month=2024-03')).totals;
      expect(totals.linesAdded).toBe(10);
      expect(totals.filesChanged).toBe(1);
    });

    it('ignores binary files, which git reports without line counts', async () => {
      const { db, app } = context.get();
      await seedProject(db, { path: '/repos/alpha' });

      gitLogHandler = () => `2024-03-04|hash0\n-\t-\tlogo.png\n8\t1\tsrc/index.ts`;

      const totals = body(await get(app, '/api/projects/git-stats?month=2024-03')).totals;
      expect(totals.filesChanged).toBe(1);
      expect(totals.linesAdded).toBe(8);
    });

    it('scopes results to one project when projectId is given', async () => {
      const { db, app } = context.get();
      const alpha = await seedProject(db, { path: '/repos/alpha' });
      await seedProject(db, { path: '/repos/beta' });

      gitLogHandler = cwd =>
        cwd === '/repos/alpha'
          ? gitLog([{ date: '2024-03-04', files: [[10, 0, 'a.ts']] }])
          : gitLog([{ date: '2024-03-05', files: [[99, 0, 'b.ts']] }]);

      const stats = body(
        await get(app, `/api/projects/git-stats?month=2024-03&projectId=${alpha.id}`)
      );

      const logCwds = execCalls.filter(c => c.args[0] === 'log').map(c => c.options.cwd);
      expect(logCwds).toEqual(['/repos/alpha']);
      expect(stats.totals.linesAdded).toBe(10);
      expect(stats.totals.projectsWorkedOn).toBe(1);
    });

    it('aggregates across projects by default', async () => {
      const { db, app } = context.get();
      await seedProject(db, { path: '/repos/alpha' });
      await seedProject(db, { path: '/repos/beta' });

      gitLogHandler = cwd =>
        cwd === '/repos/alpha'
          ? gitLog([{ date: '2024-03-04', files: [[10, 0, 'a.ts']] }])
          : gitLog([{ date: '2024-03-04', files: [[7, 0, 'b.ts']] }]);

      const stats = body(await get(app, '/api/projects/git-stats?month=2024-03'));

      expect(stats.totals.linesAdded).toBe(17);
      expect(stats.totals.projectsWorkedOn).toBe(2);
      expect(stats.days.find(d => d.date === '2024-03-04')?.projectsWorkedOn).toBe(2);
    });

    it('returns a well-formed empty payload for a month with no commits', async () => {
      const { db, app } = context.get();
      await seedProject(db, { path: '/repos/alpha' });
      gitLogHandler = () => '';

      const stats = body(await get(app, '/api/projects/git-stats?month=2024-03&detail=full'));

      expect(stats.days).toHaveLength(31);
      expect(stats.totals.commits).toBe(0);
      expect(stats.totals.filesChanged).toBe(0);
      expect(stats.detail?.topFiles).toEqual([]);
      expect(stats.detail?.languages).toEqual([]);
      expect(stats.detail?.busiestDay).toBeNull();
    });

    it('skips a project whose git call fails without failing the request', async () => {
      const { db, app } = context.get();
      await seedProject(db, { path: '/repos/alpha' });
      await seedProject(db, { path: '/repos/broken' });

      gitLogHandler = cwd => {
        if (cwd === '/repos/broken') throw new Error('not a git repository');
        return gitLog([{ date: '2024-03-04', files: [[4, 0, 'a.ts']] }]);
      };

      const response = await get(app, '/api/projects/git-stats?month=2024-03');

      expect(response.status).toBe(200);
      expect(body(response).totals.linesAdded).toBe(4);
    });
  });

  describe('detail=full', () => {
    it('ranks top files by total churn', async () => {
      const { db, app } = context.get();
      await seedProject(db, { path: '/repos/alpha' });

      gitLogHandler = () =>
        gitLog([
          {
            date: '2024-03-04',
            files: [
              [5, 0, 'small.ts'],
              [100, 50, 'big.ts'],
              [20, 5, 'medium.ts'],
            ],
          },
        ]);

      const topFiles = body(await get(app, '/api/projects/git-stats?month=2024-03&detail=full'))
        .detail!.topFiles;

      expect(topFiles.map(f => f.path)).toEqual(['big.ts', 'medium.ts', 'small.ts']);
      expect(topFiles[0]).toMatchObject({ linesAdded: 100, linesRemoved: 50, changes: 150 });
    });

    it('attributes a rename to the new path only', async () => {
      const { db, app } = context.get();
      await seedProject(db, { path: '/repos/alpha' });

      gitLogHandler = () =>
        `2024-03-04|hash0\n10\t2\told.ts => new.ts\n4\t1\tsrc/{a => b}/index.ts`;

      const topFiles = body(await get(app, '/api/projects/git-stats?month=2024-03&detail=full'))
        .detail!.topFiles;

      const paths = topFiles.map(f => f.path);
      expect(paths).toContain('new.ts');
      expect(paths).toContain('src/b/index.ts');
      expect(paths.some(p => p.includes('=>'))).toBe(false);
    });

    it('groups changed lines by language and buckets unknown extensions', async () => {
      const { db, app } = context.get();
      await seedProject(db, { path: '/repos/alpha' });

      gitLogHandler = () =>
        gitLog([
          {
            date: '2024-03-04',
            files: [
              [60, 0, 'src/app.ts'],
              [30, 0, 'src/App.vue'],
              [10, 0, 'notes.xyzzy'],
            ],
          },
        ]);

      const languages = body(await get(app, '/api/projects/git-stats?month=2024-03&detail=full'))
        .detail!.languages;

      const bySlug = Object.fromEntries(languages.map(l => [l.slug, l]));
      expect(bySlug.typescript?.linesChanged).toBe(60);
      expect(bySlug.vue?.linesChanged).toBe(30);
      // Unrecognised extensions are bucketed, not dropped, so percentages are honest.
      expect(bySlug.other?.linesChanged).toBe(10);

      const total = languages.reduce((sum, l) => sum + l.percentage, 0);
      expect(total).toBeGreaterThan(99);
      expect(total).toBeLessThan(101);

      // Labels and colors are resolved server-side, so aggregate views need no lookup.
      expect(bySlug.typescript?.label).toBeTruthy();
    });

    it('reports the busiest day and streaks', async () => {
      const { db, app } = context.get();
      await seedProject(db, { path: '/repos/alpha' });

      gitLogHandler = () =>
        gitLog([
          { date: '2024-03-04', files: [[1, 0, 'a.ts']] },
          { date: '2024-03-05', files: [[1, 0, 'a.ts']] },
          { date: '2024-03-05', files: [[1, 0, 'b.ts']] },
          { date: '2024-03-06', files: [[1, 0, 'a.ts']] },
        ]);

      const detail = body(
        await get(app, '/api/projects/git-stats?month=2024-03&detail=full')
      ).detail!;

      expect(detail.busiestDay).toEqual({ date: '2024-03-05', commits: 2 });
      expect(detail.streaks.longest).toBe(3);
      // A month that ended in the past has no running streak.
      expect(detail.streaks.current).toBe(0);
    });

    it('breaks results down per project', async () => {
      const { db, app } = context.get();
      await seedProject(db, { path: '/repos/alpha' });
      await seedProject(db, { path: '/repos/beta' });

      gitLogHandler = cwd =>
        cwd === '/repos/alpha'
          ? gitLog([{ date: '2024-03-04', files: [[10, 0, 'a.ts']] }])
          : gitLog([
              { date: '2024-03-04', files: [[7, 0, 'b.ts']] },
              { date: '2024-03-05', files: [[7, 0, 'b.ts']] },
            ]);

      const perProject = body(await get(app, '/api/projects/git-stats?month=2024-03&detail=full'))
        .detail!.perProject;

      // Sorted by commits, busiest first.
      expect(perProject.map(p => p.projectPath)).toEqual(['/repos/beta', '/repos/alpha']);
      expect(perProject[0].commits).toBe(2);
    });
  });

  describe('caching', () => {
    it('reuses a cached historical month instead of re-reading git', async () => {
      const { db, app } = context.get();
      await seedProject(db, { path: '/repos/alpha' });
      gitLogHandler = () => gitLog([{ date: '2024-03-04', files: [[1, 0, 'a.ts']] }]);

      const first = body(await get(app, '/api/projects/git-stats?month=2024-03'));
      const logCallsAfterFirst = execCalls.filter(c => c.args[0] === 'log').length;

      const second = body(await get(app, '/api/projects/git-stats?month=2024-03'));

      expect(execCalls.filter(c => c.args[0] === 'log')).toHaveLength(logCallsAfterFirst);
      expect(second).toEqual(first);
    });

    it('keeps separate entries per project filter', async () => {
      const { db, app } = context.get();
      const alpha = await seedProject(db, { path: '/repos/alpha' });
      await seedProject(db, { path: '/repos/beta' });

      gitLogHandler = cwd =>
        cwd === '/repos/alpha'
          ? gitLog([{ date: '2024-03-04', files: [[10, 0, 'a.ts']] }])
          : gitLog([{ date: '2024-03-04', files: [[7, 0, 'b.ts']] }]);

      const all = body(await get(app, '/api/projects/git-stats?month=2024-03'));
      const scoped = body(
        await get(app, `/api/projects/git-stats?month=2024-03&projectId=${alpha.id}`)
      );

      expect(all.totals.linesAdded).toBe(17);
      expect(scoped.totals.linesAdded).toBe(10);
    });
  });
});
