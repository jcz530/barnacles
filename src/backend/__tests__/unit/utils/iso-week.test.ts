import { describe, expect, it } from 'vitest';
import {
  addIsoWeeks,
  bucketByIsoWeek,
  formatIsoWeekLabel,
  isoWeekStart,
  toIsoWeek,
} from '@shared/utils/iso-week';

/**
 * ISO weeks run Monday-Sunday, and a week belongs to whichever year contains
 * its Thursday. The boundary cases are where this is easy to get wrong.
 */
describe('toIsoWeek', () => {
  it('formats a mid-year date', () => {
    expect(toIsoWeek('2024-03-06')).toBe('2024-W10');
  });

  it('pads single-digit weeks', () => {
    expect(toIsoWeek('2024-01-04')).toBe('2024-W01');
  });

  it('assigns late December to the next ISO year when the week belongs there', () => {
    // Mon 30 Dec 2024 starts ISO week 1 of 2025.
    expect(toIsoWeek('2024-12-30')).toBe('2025-W01');
  });

  it('assigns early January to the previous ISO year when the week belongs there', () => {
    // 1 Jan 2021 falls in ISO week 53 of 2020.
    expect(toIsoWeek('2021-01-01')).toBe('2020-W53');
  });
});

describe('isoWeekStart', () => {
  it('returns the Monday of the week', () => {
    expect(isoWeekStart('2024-W10').format('YYYY-MM-DD')).toBe('2024-03-04');
  });

  it('resolves a week that starts in the previous calendar year', () => {
    expect(isoWeekStart('2025-W01').format('YYYY-MM-DD')).toBe('2024-12-30');
  });

  it('resolves week 53 of a long year', () => {
    expect(isoWeekStart('2020-W53').format('YYYY-MM-DD')).toBe('2020-12-28');
  });

  it('round-trips with toIsoWeek', () => {
    for (const week of ['2024-W01', '2024-W10', '2024-W52', '2020-W53', '2025-W01']) {
      expect(toIsoWeek(isoWeekStart(week))).toBe(week);
    }
  });
});

describe('addIsoWeeks', () => {
  it('steps forward and back', () => {
    expect(addIsoWeeks('2024-W10', 1)).toBe('2024-W11');
    expect(addIsoWeeks('2024-W10', -1)).toBe('2024-W09');
  });

  it('crosses a year boundary', () => {
    expect(addIsoWeeks('2024-W52', 1)).toBe('2025-W01');
    expect(addIsoWeeks('2025-W01', -1)).toBe('2024-W52');
  });

  it('steps through week 53 of a long year', () => {
    expect(addIsoWeeks('2020-W52', 1)).toBe('2020-W53');
    expect(addIsoWeeks('2020-W53', 1)).toBe('2021-W01');
  });
});

describe('formatIsoWeekLabel', () => {
  it('collapses the month when the week sits inside one', () => {
    expect(formatIsoWeekLabel('2024-W10')).toBe('Mar 4 – 10, 2024');
  });

  it('shows both months when the week straddles them', () => {
    // Mon 29 Apr to Sun 5 May 2024.
    expect(formatIsoWeekLabel('2024-W18')).toBe('Apr 29 – May 5, 2024');
  });

  it('shows both years when the week straddles them', () => {
    expect(formatIsoWeekLabel('2025-W01')).toBe('Dec 30, 2024 – Jan 5, 2025');
  });
});

describe('bucketByIsoWeek', () => {
  const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
  const max = (values: number[]) => Math.max(...values, 0);

  /** Consecutive days starting from a date. */
  function series(start: string, values: number[]) {
    return values.map((value, index) => ({
      date: isoWeekStart(toIsoWeek(start)).add(index, 'day').format('YYYY-MM-DD'),
      value,
    }));
  }

  it('returns an empty array for no input', () => {
    expect(bucketByIsoWeek([], sum)).toEqual([]);
  });

  it('collapses seven days into one bucket', () => {
    // Mon 4 Mar 2024 through Sun 10 Mar — one ISO week.
    const result = bucketByIsoWeek(series('2024-03-04', [1, 2, 3, 4, 5, 6, 7]), sum);

    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(28);
    // Labelled with the bucket's first day, so tooltips show a real date.
    expect(result[0].date).toBe('2024-03-04');
  });

  it('splits days across week boundaries', () => {
    // 14 consecutive days from a Monday spans exactly two ISO weeks.
    const result = bucketByIsoWeek(series('2024-03-04', Array(14).fill(1)), sum);

    expect(result).toHaveLength(2);
    expect(result[0].value).toBe(7);
    expect(result[1].value).toBe(7);
  });

  it('preserves chronological order', () => {
    const result = bucketByIsoWeek(series('2024-03-04', Array(21).fill(1)), sum);
    const dates = result.map(bucket => bucket.date);

    expect([...dates].sort()).toEqual(dates);
  });

  it('groups a full year into about 52 buckets', () => {
    const days = Array.from({ length: 365 }, (_, index) => ({
      date: `2023-01-01`,
      value: index,
    })).map((entry, index) => ({
      date: isoWeekStart('2023-W01').add(index, 'day').format('YYYY-MM-DD'),
      value: entry.value,
    }));

    const result = bucketByIsoWeek(days, sum);
    // The point of bucketing: a tile can render ~52 bars, not 365.
    expect(result.length).toBeGreaterThanOrEqual(52);
    expect(result.length).toBeLessThanOrEqual(54);
  });

  it('honours the combine function rather than always summing', () => {
    const week = series('2024-03-04', [3, 1, 9, 2, 5, 0, 4]);

    // A distinct-project count must not be added across days.
    expect(bucketByIsoWeek(week, max)[0].value).toBe(9);
    expect(bucketByIsoWeek(week, sum)[0].value).toBe(24);
  });

  it('supports a binary any-activity combine', () => {
    const anyActive = (values: number[]) => (max(values) > 0 ? 1 : 0);

    expect(bucketByIsoWeek(series('2024-03-04', [0, 0, 0, 1, 0, 0, 0]), anyActive)[0].value).toBe(
      1
    );
    expect(bucketByIsoWeek(series('2024-03-04', Array(7).fill(0)), anyActive)[0].value).toBe(0);
  });

  it('keeps a year-boundary week as a single bucket', () => {
    // 30 Dec 2024 (Mon) to 5 Jan 2025 (Sun) is all of 2025-W01.
    const result = bucketByIsoWeek(series('2024-12-30', [1, 1, 1, 1, 1, 1, 1]), sum);

    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(7);
  });
});
