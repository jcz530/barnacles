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

  describe('year requests', () => {
    it('returns every day of the requested year', async () => {
      const { app } = context.get();
      const response = await get(app, '/api/projects/git-stats?year=2023');

      expect(response.status).toBe(200);
      const stats = body(response);
      expect(stats.period).toBe('custom-year');
      expect(stats.days).toHaveLength(365);
      expect(stats.days[0].date).toBe('2023-01-01');
      expect(stats.days[364].date).toBe('2023-12-31');
      expect(stats.range).toMatchObject({
        since: '2023-01-01',
        until: '2023-12-31',
        year: '2023',
      });
    });

    it('covers the extra day of a leap year', async () => {
      const { app } = context.get();
      const stats = body(await get(app, '/api/projects/git-stats?year=2024'));

      expect(stats.days).toHaveLength(366);
      expect(stats.days.some(day => day.date === '2024-02-29')).toBe(true);
    });

    it('rejects a malformed year', async () => {
      const { app } = context.get();

      for (const year of ['24', 'nonsense', '1960', '20233']) {
        const response = await get(app, `/api/projects/git-stats?year=${year}`);
        expect(response.status, `year=${year}`).toBe(400);
      }
    });

    it('rejects a future year', async () => {
      const { app } = context.get();
      const response = await get(app, '/api/projects/git-stats?year=2099');

      expect(response.status).toBe(400);
      expect((response.data as any).code).toBe('FUTURE_YEAR');
    });

    it('yields to month and week when several ranges are given', async () => {
      const { app } = context.get();

      const withMonth = body(await get(app, '/api/projects/git-stats?year=2023&month=2024-03'));
      expect(withMonth.period).toBe('custom-month');
      expect(withMonth.range.year).toBeUndefined();

      const withWeek = body(await get(app, '/api/projects/git-stats?year=2023&week=2024-W10'));
      expect(withWeek.period).toBe('custom-week');
      expect(withWeek.range.year).toBeUndefined();
    });

    it('aggregates commits across the whole year', async () => {
      const { db, app } = context.get();
      await seedProject(db, { path: '/repos/alpha' });

      gitLogHandler = () =>
        gitLog([
          { date: '2023-01-15', files: [[10, 0, 'a.ts']] },
          { date: '2023-06-30', files: [[5, 2, 'b.ts']] },
          // The final day of the year, dropped if --until lands on midnight.
          { date: '2023-12-31', files: [[3, 1, 'c.ts']] },
        ]);

      const stats = body(await get(app, '/api/projects/git-stats?year=2023'));

      const logCall = execCalls.find(call => call.args[0] === 'log');
      expect(logCall?.args).toContain('--until=2023-12-31T23:59:59');
      expect(stats.totals.commits).toBe(3);
      expect(stats.totals.linesAdded).toBe(18);
      expect(stats.totals.activeDays).toBe(3);
      expect(stats.days[364].commits).toBe(1);
    });
  });

  describe('week requests', () => {
    it('returns the seven days of an ISO week, Monday first', async () => {
      const { app } = context.get();
      const response = await get(app, '/api/projects/git-stats?week=2024-W10');

      expect(response.status).toBe(200);
      const stats = body(response);
      expect(stats.period).toBe('custom-week');
      expect(stats.days).toHaveLength(7);
      // ISO week 10 of 2024 runs Mon 4 Mar to Sun 10 Mar.
      expect(stats.days[0].date).toBe('2024-03-04');
      expect(stats.days[6].date).toBe('2024-03-10');
      expect(stats.range).toMatchObject({
        since: '2024-03-04',
        until: '2024-03-10',
        week: '2024-W10',
      });
    });

    it('handles a week spanning a year boundary', async () => {
      const { app } = context.get();
      // 2025-W01 starts Mon 30 Dec 2024 — the ISO year and calendar year differ.
      const stats = body(await get(app, '/api/projects/git-stats?week=2025-W01'));

      expect(stats.days).toHaveLength(7);
      expect(stats.days[0].date).toBe('2024-12-30');
      expect(stats.days[6].date).toBe('2025-01-05');
    });

    it('accepts week 53 in a long year', async () => {
      const { app } = context.get();
      // 2020 is a 53-week ISO year.
      const response = await get(app, '/api/projects/git-stats?week=2020-W53');
      expect(response.status).toBe(200);
      expect(body(response).days).toHaveLength(7);
    });

    it('rejects week 53 in a year that has only 52', async () => {
      const { app } = context.get();
      const response = await get(app, '/api/projects/git-stats?week=2024-W53');

      expect(response.status).toBe(400);
      expect((response.data as any).code).toBe('INVALID_WEEK');
    });

    it('rejects a malformed week', async () => {
      const { app } = context.get();

      for (const week of ['2024-W00', '2024-W54', '2024-W1', 'nonsense', '2024W10']) {
        const response = await get(app, `/api/projects/git-stats?week=${week}`);
        expect(response.status, `week=${week}`).toBe(400);
      }
    });

    it('rejects a future week', async () => {
      const { app } = context.get();
      const response = await get(app, '/api/projects/git-stats?week=2099-W01');

      expect(response.status).toBe(400);
      expect((response.data as any).code).toBe('FUTURE_WEEK');
    });

    it('takes precedence over month when both are given', async () => {
      const { app } = context.get();
      const stats = body(await get(app, '/api/projects/git-stats?week=2024-W10&month=2024-06'));

      expect(stats.period).toBe('custom-week');
      expect(stats.days).toHaveLength(7);
      expect(stats.range.month).toBeUndefined();
    });

    it('counts commits within the week and bounds the last day', async () => {
      const { db, app } = context.get();
      await seedProject(db, { path: '/repos/alpha' });

      gitLogHandler = () =>
        gitLog([
          { date: '2024-03-04', files: [[5, 0, 'a.ts']] },
          // Sunday, the final day — dropped if --until lands on midnight.
          { date: '2024-03-10', files: [[8, 0, 'b.ts']] },
        ]);

      const stats = body(await get(app, '/api/projects/git-stats?week=2024-W10'));

      const logCall = execCalls.find(call => call.args[0] === 'log');
      expect(logCall?.args).toContain('--until=2024-03-10T23:59:59');
      expect(stats.totals.commits).toBe(2);
      expect(stats.totals.linesAdded).toBe(13);
      expect(stats.days[6].commits).toBe(1);
    });

    it('caches weeks separately from months covering the same days', async () => {
      const { db, app } = context.get();
      await seedProject(db, { path: '/repos/alpha' });
      gitLogHandler = () => gitLog([{ date: '2024-03-04', files: [[5, 0, 'a.ts']] }]);

      const week = body(await get(app, '/api/projects/git-stats?week=2024-W10'));
      const month = body(await get(app, '/api/projects/git-stats?month=2024-03'));

      // Same underlying commit, but the ranges differ — one must not serve the other.
      expect(week.days).toHaveLength(7);
      expect(month.days).toHaveLength(31);
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

    it('spans several projects when projectId is repeated', async () => {
      const { db, app } = context.get();
      const alpha = await seedProject(db, { path: '/repos/alpha' });
      const beta = await seedProject(db, { path: '/repos/beta' });
      await seedProject(db, { path: '/repos/gamma' });

      gitLogHandler = cwd => {
        if (cwd === '/repos/alpha')
          return gitLog([{ date: '2024-03-04', files: [[10, 0, 'a.ts']] }]);
        if (cwd === '/repos/beta') return gitLog([{ date: '2024-03-05', files: [[7, 0, 'b.ts']] }]);
        return gitLog([{ date: '2024-03-06', files: [[999, 0, 'c.ts']] }]);
      };

      const stats = body(
        await get(
          app,
          `/api/projects/git-stats?month=2024-03&projectId=${alpha.id}&projectId=${beta.id}`
        )
      );

      const logCwds = execCalls.filter(c => c.args[0] === 'log').map(c => c.options.cwd);
      expect(logCwds.sort()).toEqual(['/repos/alpha', '/repos/beta']);
      // gamma was not selected, so its 999 lines must not appear.
      expect(stats.totals.linesAdded).toBe(17);
      expect(stats.totals.projectsWorkedOn).toBe(2);
    });

    it('counts a repeated id once', async () => {
      const { db, app } = context.get();
      const alpha = await seedProject(db, { path: '/repos/alpha' });

      gitLogHandler = () => gitLog([{ date: '2024-03-04', files: [[10, 0, 'a.ts']] }]);

      const stats = body(
        await get(
          app,
          `/api/projects/git-stats?month=2024-03&projectId=${alpha.id}&projectId=${alpha.id}`
        )
      );

      const logCwds = execCalls.filter(c => c.args[0] === 'log').map(c => c.options.cwd);
      expect(logCwds).toEqual(['/repos/alpha']);
      // Double-counting here would silently inflate every total.
      expect(stats.totals.linesAdded).toBe(10);
    });

    it('rejects the whole request when one of several ids is unknown', async () => {
      const { db, app } = context.get();
      const alpha = await seedProject(db, { path: '/repos/alpha' });

      const response = await get(
        app,
        `/api/projects/git-stats?month=2024-03&projectId=${alpha.id}&projectId=missing`
      );

      expect(response.status).toBe(400);
      expect((response.data as any).code).toBe('UNKNOWN_PROJECT');
    });

    it('rejects more project ids than the cap allows', async () => {
      const { app } = context.get();
      const ids = Array.from({ length: 51 }, (_, i) => `projectId=id-${i}`).join('&');

      const response = await get(app, `/api/projects/git-stats?month=2024-03&${ids}`);

      expect(response.status).toBe(400);
      expect((response.data as any).code).toBe('TOO_MANY_PROJECTS');
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

    it('reuses one cache entry regardless of the order ids arrive in', async () => {
      const { db, app } = context.get();
      const alpha = await seedProject(db, { path: '/repos/alpha' });
      const beta = await seedProject(db, { path: '/repos/beta' });

      gitLogHandler = cwd =>
        cwd === '/repos/alpha'
          ? gitLog([{ date: '2024-03-04', files: [[10, 0, 'a.ts']] }])
          : gitLog([{ date: '2024-03-04', files: [[7, 0, 'b.ts']] }]);

      const first = body(
        await get(
          app,
          `/api/projects/git-stats?month=2024-03&projectId=${alpha.id}&projectId=${beta.id}`
        )
      );
      const logCallsAfterFirst = execCalls.filter(c => c.args[0] === 'log').length;

      // Same set, opposite order. The service sorts paths into its cache key, so
      // this must not re-shell git.
      const second = body(
        await get(
          app,
          `/api/projects/git-stats?month=2024-03&projectId=${beta.id}&projectId=${alpha.id}`
        )
      );

      expect(execCalls.filter(c => c.args[0] === 'log')).toHaveLength(logCallsAfterFirst);
      expect(second).toEqual(first);
    });

    it('keeps a revisited month cached while paging past the entry limit', async () => {
      const { db, app } = context.get();
      await seedProject(db, { path: '/repos/alpha' });
      gitLogHandler = () => gitLog([{ date: '2024-03-04', files: [[1, 0, 'a.ts']] }]);

      const logCalls = () => execCalls.filter(c => c.args[0] === 'log').length;
      // Imported dynamically to match how this suite reaches the service
      // elsewhere: vi.mock() is hoisted, so a static import would load the
      // module before child_process is mocked.
      const { MAX_CACHE_ENTRIES } = await import(
        '@backend/services/project/project-git-stats-service'
      );
      // Derived from the real ceiling rather than hardcoded, so raising
      // MAX_CACHE_ENTRIES can't quietly turn this into a no-op test.
      const months = Array.from({ length: MAX_CACHE_ENTRIES + 5 }, (_, i) => {
        const year = 2000 + Math.floor(i / 12);
        return `${year}-${String((i % 12) + 1).padStart(2, '0')}`;
      });

      // Warm the month we keep coming back to.
      await get(app, '/api/projects/git-stats?month=2024-03');
      const afterWarm = logCalls();

      // Page through more months than the cache holds, revisiting the warm one
      // along the way. Insertion-order eviction would drop it despite the
      // repeated reads; LRU keeps it because it is never the least-recently-used.
      for (const month of months) {
        await get(app, `/api/projects/git-stats?month=${month}`);
        await get(app, '/api/projects/git-stats?month=2024-03');
      }

      const revisitCalls = logCalls() - afterWarm;
      // Only the cold months should have shelled out to git; every revisit of
      // 2024-03 is served from cache.
      expect(revisitCalls).toBe(months.length);
    });
  });
});
