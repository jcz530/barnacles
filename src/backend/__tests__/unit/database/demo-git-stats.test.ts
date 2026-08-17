import { describe, expect, it } from 'vitest';
import { buildDemoGitStats } from '@shared/database/demo/data/git-stats';
import {
  DEMO_RUNNING_PROCESSES,
  getDemoRunningProcesses,
} from '@shared/database/demo/data/running-processes';
import { DEMO_PROJECTS } from '@shared/database/demo/data/projects';
import { DEMO_PROCESSES } from '@shared/database/demo/data/processes';

function range(start: string, days: number): string[] {
  const out: string[] = [];
  const base = new Date(`${start}T12:00:00Z`);
  for (let i = 0; i < days; i++) {
    const day = new Date(base);
    day.setUTCDate(base.getUTCDate() + i);
    out.push(day.toISOString().slice(0, 10));
  }
  return out;
}

/** buildDemoGitStats takes an options object; dates drive everything else. */
function build(
  period: 'week' | 'month' | 'last-week' | 'custom-month',
  dates: string[],
  detail = false
) {
  return buildDemoGitStats({
    period,
    range: { since: dates[0], until: dates[dates.length - 1] },
    dates,
    detail,
  });
}

describe('demo git stats', () => {
  const week = range('2026-08-10', 7);

  it('returns one entry per requested date', () => {
    const stats = build('week', week);
    expect(stats.days.map(d => d.date)).toEqual(week);
    expect(stats.period).toBe('week');
  });

  it('produces non-zero activity so the dashboard is not empty', () => {
    const stats = build('week', week);
    expect(stats.totals.commits).toBeGreaterThan(0);
    expect(stats.totals.linesAdded).toBeGreaterThan(0);
    expect(stats.totals.filesChanged).toBeGreaterThan(0);
  });

  it('is deterministic for the same dates', () => {
    expect(build('week', week)).toEqual(build('week', week));
  });

  it('populates a range that lies entirely in the future', () => {
    // The app's week runs Monday-Sunday, so on a Sunday the whole range is in
    // the future. Those days must still be filled or the dashboard reads zero.
    const future = range('2099-01-05', 7);
    const stats = build('week', future);
    expect(stats.totals.commits).toBeGreaterThan(0);
  });

  it('leaves days after today empty within a current range', () => {
    const today = new Date().toISOString().slice(0, 10);
    const start = new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10);
    const stats = build('week', range(start, 7));

    const future = stats.days.filter(day => day.date > today);
    expect(future.length).toBeGreaterThan(0);
    for (const day of future) {
      expect(day.commits, `${day.date} should have no commits yet`).toBe(0);
    }
  });

  it('keeps totals consistent with the per-day values', () => {
    const stats = build('month', range('2026-07-01', 31));
    const summed = stats.days.reduce((sum, day) => sum + day.commits, 0);
    expect(stats.totals.commits).toBe(summed);
  });

  it('populates a fully historical month so the Stats page can step back', () => {
    const stats = build('custom-month', range('2024-03-01', 31));
    expect(stats.days).toHaveLength(31);
    // Every day is in the past, so none should be blanked by the future cutoff.
    expect(stats.days.every(day => day.commits > 0 || day.date !== stats.days[0].date)).toBe(true);
    expect(stats.totals.commits).toBeGreaterThan(0);
    expect(stats.totals.activeDays).toBeGreaterThan(0);
  });

  it('omits the detail block unless it is requested', () => {
    expect(build('custom-month', range('2024-03-01', 31)).detail).toBeUndefined();
  });

  it('builds deterministic detail for the Stats page', () => {
    const dates = range('2024-03-01', 31);
    const stats = build('custom-month', dates, true);
    const detail = stats.detail!;

    expect(detail.topFiles.length).toBeGreaterThan(0);
    // Sorted by total churn, descending.
    const changes = detail.topFiles.map(f => f.changes);
    expect([...changes].sort((a, b) => b - a)).toEqual(changes);

    expect(detail.languages.length).toBeGreaterThan(0);
    const totalPercentage = detail.languages.reduce((sum, l) => sum + l.percentage, 0);
    expect(totalPercentage).toBeGreaterThan(99);
    expect(totalPercentage).toBeLessThan(101);

    expect(detail.busiestDay).not.toBeNull();
    expect(detail.streaks.longest).toBeGreaterThan(0);

    expect(build('custom-month', dates, true)).toEqual(stats);
  });
});

describe('demo running processes', () => {
  it('marks only a couple of projects as live', () => {
    // A dashboard where everything is running looks staged.
    expect(DEMO_RUNNING_PROCESSES.length).toBeGreaterThan(0);
    expect(DEMO_RUNNING_PROCESSES.length).toBeLessThan(4);
  });

  it('references real demo projects and seeded process ids', () => {
    const projectIds = new Set(DEMO_PROJECTS.map(p => p.id));
    const processIds = new Set(DEMO_PROCESSES.map(p => p.id));

    for (const status of DEMO_RUNNING_PROCESSES) {
      expect(projectIds).toContain(status.projectId);
      for (const process of status.processes) {
        expect(processIds, `unknown process ${process.processId}`).toContain(process.processId);
      }
    }
  });

  it('exposes a localhost URL so cards show a live link', () => {
    const urls = DEMO_RUNNING_PROCESSES.flatMap(s => s.processes.map(p => p.url)).filter(Boolean);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url).toMatch(/^http:\/\/localhost:\d+$/);
    }
  });

  it('reports every mocked process as running with a start time', () => {
    for (const status of getDemoRunningProcesses()) {
      for (const process of status.processes) {
        expect(process.status).toBe('running');
        expect(process.createdAt).toBeTruthy();
        expect(new Date(process.createdAt!).getTime()).toBeLessThan(Date.now());
      }
    }
  });
});
