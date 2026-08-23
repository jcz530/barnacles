import { describe, expect, it } from 'vitest';
import { zeroFillSeries } from '@backend/services/event-service';

describe('zeroFillSeries', () => {
  const today = new Date('2026-03-10T12:00:00');

  it('returns one bucket per day in the window', () => {
    const series = zeroFillSeries([], 7, today);

    expect(series).toHaveLength(7);
    expect(series[0].date).toBe('2026-03-04');
    expect(series[6].date).toBe('2026-03-10');
  });

  it('fills days with no activity with zeros', () => {
    const series = zeroFillSeries([{ date: '2026-03-10', total: 3, errors: 1 }], 3, today);

    expect(series).toEqual([
      { date: '2026-03-08', total: 0, errors: 0 },
      { date: '2026-03-09', total: 0, errors: 0 },
      { date: '2026-03-10', total: 3, errors: 1 },
    ]);
  });

  it('keeps buckets in ascending date order', () => {
    const series = zeroFillSeries(
      [
        { date: '2026-03-10', total: 1, errors: 0 },
        { date: '2026-03-08', total: 2, errors: 0 },
      ],
      3,
      today
    );

    expect(series.map(b => b.date)).toEqual(['2026-03-08', '2026-03-09', '2026-03-10']);
    expect(series.map(b => b.total)).toEqual([2, 0, 1]);
  });

  it('ignores rows outside the requested window', () => {
    const series = zeroFillSeries(
      [
        { date: '2026-01-01', total: 99, errors: 99 },
        { date: '2026-03-10', total: 1, errors: 0 },
      ],
      2,
      today
    );

    expect(series).toHaveLength(2);
    expect(series.reduce((sum, b) => sum + b.total, 0)).toBe(1);
  });

  it('handles a single-day window', () => {
    const series = zeroFillSeries([{ date: '2026-03-10', total: 5, errors: 2 }], 1, today);

    expect(series).toEqual([{ date: '2026-03-10', total: 5, errors: 2 }]);
  });

  it('crosses month boundaries correctly', () => {
    const series = zeroFillSeries([], 3, new Date('2026-03-02T12:00:00'));

    expect(series.map(b => b.date)).toEqual(['2026-02-28', '2026-03-01', '2026-03-02']);
  });
});
