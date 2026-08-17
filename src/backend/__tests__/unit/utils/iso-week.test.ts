import { describe, expect, it } from 'vitest';
import { addIsoWeeks, formatIsoWeekLabel, isoWeekStart, toIsoWeek } from '@/utils/iso-week';

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
