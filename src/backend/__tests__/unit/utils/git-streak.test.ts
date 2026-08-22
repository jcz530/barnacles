import { describe, expect, it } from 'vitest';
import { calculateStreaks, todayIsoDate } from '@shared/utils/git-streak';

/** Build day records from a date -> commits map, in arbitrary order. */
function days(entries: Record<string, number>) {
  return Object.entries(entries).map(([date, commits]) => ({ date, commits }));
}

function offsetDate(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

describe('calculateStreaks', () => {
  it('returns zeros for no input', () => {
    expect(calculateStreaks([])).toEqual({ current: 0, longest: 0, warning: false });
  });

  it('returns zeros when nothing was committed', () => {
    const result = calculateStreaks(days({ '2024-03-01': 0, '2024-03-02': 0 }));
    expect(result.longest).toBe(0);
    expect(result.current).toBe(0);
  });

  it('finds the longest run of consecutive days', () => {
    const result = calculateStreaks(
      days({
        '2024-03-01': 2,
        '2024-03-02': 1,
        '2024-03-03': 4,
        // gap
        '2024-03-06': 3,
      }),
      '2024-03-06'
    );

    expect(result.longest).toBe(3);
    expect(result.longestStart).toBe('2024-03-01');
    expect(result.longestEnd).toBe('2024-03-03');
  });

  it('ignores input order', () => {
    const ordered = calculateStreaks(
      days({ '2024-03-01': 1, '2024-03-02': 1, '2024-03-03': 1 }),
      '2024-03-03'
    );
    const shuffled = calculateStreaks(
      days({ '2024-03-03': 1, '2024-03-01': 1, '2024-03-02': 1 }),
      '2024-03-03'
    );
    expect(shuffled).toEqual(ordered);
  });

  it('counts a repeated date once', () => {
    // Callers merge per-project data, so the same day can arrive twice.
    const result = calculateStreaks(
      [
        { date: '2024-03-01', commits: 1 },
        { date: '2024-03-01', commits: 5 },
        { date: '2024-03-02', commits: 1 },
      ],
      '2024-03-02'
    );
    expect(result.longest).toBe(2);
  });

  it('reports no current streak for a range that ended in the past', () => {
    const result = calculateStreaks(days({ '2024-03-01': 1, '2024-03-02': 1 }), '2024-03-02');
    // The run happened, but it is not running now.
    expect(result.longest).toBe(2);
    expect(result.current).toBe(0);
    expect(result.warning).toBe(false);
  });

  it('counts a live streak ending today', () => {
    const result = calculateStreaks(
      days({ [offsetDate(-2)]: 1, [offsetDate(-1)]: 1, [offsetDate(0)]: 1 }),
      todayIsoDate()
    );
    expect(result.current).toBe(3);
    expect(result.warning).toBe(false);
  });

  it('keeps the streak but warns when the last commit was yesterday', () => {
    const result = calculateStreaks(
      days({ [offsetDate(-2)]: 1, [offsetDate(-1)]: 1 }),
      todayIsoDate()
    );
    expect(result.current).toBe(2);
    expect(result.warning).toBe(true);
  });

  it('breaks the streak once the last commit is older than yesterday', () => {
    const result = calculateStreaks(
      days({ [offsetDate(-4)]: 1, [offsetDate(-3)]: 1 }),
      todayIsoDate()
    );
    expect(result.current).toBe(0);
    expect(result.warning).toBe(false);
    expect(result.longest).toBe(2);
  });

  it('handles a single active day', () => {
    const result = calculateStreaks(days({ '2024-03-01': 7 }), '2024-03-01');
    expect(result.longest).toBe(1);
    expect(result.longestStart).toBe('2024-03-01');
    expect(result.longestEnd).toBe('2024-03-01');
  });

  it('spans a month boundary', () => {
    const result = calculateStreaks(
      days({ '2024-01-30': 1, '2024-01-31': 1, '2024-02-01': 1 }),
      '2024-02-01'
    );
    expect(result.longest).toBe(3);
  });

  it('spans a leap day', () => {
    const result = calculateStreaks(
      days({ '2024-02-28': 1, '2024-02-29': 1, '2024-03-01': 1 }),
      '2024-03-01'
    );
    expect(result.longest).toBe(3);
  });
});
