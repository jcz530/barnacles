import { describe, expect, it } from 'vitest';
import { zeroFillSeries } from '@backend/services/event-service';

/** A grouped row as the SQL aggregate produces it. */
function row(
  date: string,
  total: number,
  errors: number,
  avgDurationMs: number | null = null,
  toolsUsed = 0
) {
  return { date, total, errors, avgDurationMs, toolsUsed };
}

describe('zeroFillSeries', () => {
  const today = new Date('2026-03-10T12:00:00');

  it('returns one bucket per day in the window', () => {
    const series = zeroFillSeries([], 7, today);

    expect(series).toHaveLength(7);
    expect(series[0].date).toBe('2026-03-04');
    expect(series[6].date).toBe('2026-03-10');
  });

  it('fills days with no activity with zeros', () => {
    const series = zeroFillSeries([row('2026-03-10', 3, 1, 12, 2)], 3, today);

    expect(series).toEqual([
      { date: '2026-03-08', total: 0, errors: 0, avgDurationMs: null, toolsUsed: 0 },
      { date: '2026-03-09', total: 0, errors: 0, avgDurationMs: null, toolsUsed: 0 },
      { date: '2026-03-10', total: 3, errors: 1, avgDurationMs: 12, toolsUsed: 2 },
    ]);
  });

  it('reports no average for a day with no calls, rather than zero', () => {
    // A 0ms average and "nothing happened" are different claims; the chart
    // relies on null to tell them apart.
    const series = zeroFillSeries([row('2026-03-10', 1, 0, 40, 1)], 2, today);

    expect(series[0].avgDurationMs).toBeNull();
    expect(series[1].avgDurationMs).toBe(40);
  });

  it('preserves a genuine zero-millisecond average', () => {
    const series = zeroFillSeries([row('2026-03-10', 2, 0, 0, 1)], 1, today);

    expect(series[0].avgDurationMs).toBe(0);
  });

  it('keeps buckets in ascending date order', () => {
    const series = zeroFillSeries([row('2026-03-10', 1, 0), row('2026-03-08', 2, 0)], 3, today);

    expect(series.map(b => b.date)).toEqual(['2026-03-08', '2026-03-09', '2026-03-10']);
    expect(series.map(b => b.total)).toEqual([2, 0, 1]);
  });

  it('carries distinct tool counts through per day', () => {
    const series = zeroFillSeries(
      [row('2026-03-09', 5, 0, 10, 3), row('2026-03-10', 2, 0, 10, 1)],
      2,
      today
    );

    expect(series.map(b => b.toolsUsed)).toEqual([3, 1]);
  });

  it('ignores rows outside the requested window', () => {
    const series = zeroFillSeries(
      [row('2026-01-01', 99, 99, 99, 9), row('2026-03-10', 1, 0)],
      2,
      today
    );

    expect(series).toHaveLength(2);
    expect(series.reduce((sum, b) => sum + b.total, 0)).toBe(1);
  });

  it('handles a single-day window', () => {
    const series = zeroFillSeries([row('2026-03-10', 5, 2, 7, 4)], 1, today);

    expect(series).toEqual([
      { date: '2026-03-10', total: 5, errors: 2, avgDurationMs: 7, toolsUsed: 4 },
    ]);
  });

  it('crosses month boundaries correctly', () => {
    const series = zeroFillSeries([], 3, new Date('2026-03-02T12:00:00'));

    expect(series.map(b => b.date)).toEqual(['2026-02-28', '2026-03-01', '2026-03-02']);
  });
});
