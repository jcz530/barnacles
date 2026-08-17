import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import isoWeeksInYear from 'dayjs/plugin/isoWeeksInYear';
import isLeapYear from 'dayjs/plugin/isLeapYear';

// isoWeeksInYear depends on isLeapYear.
dayjs.extend(isoWeek);
dayjs.extend(isLeapYear);
dayjs.extend(isoWeeksInYear);

/**
 * ISO week helpers, matching the `week=YYYY-Www` contract the API expects.
 *
 * ISO weeks run Monday-Sunday, and a week belongs to whichever year holds its
 * Thursday — so the first days of January can fall in the previous year's week
 * 52 or 53. That is why the year in `YYYY-Www` is the *ISO week year*, not
 * necessarily the calendar year of the dates it covers.
 */

/** Format a date as the ISO week that contains it, e.g. `2026-W33`. */
export function toIsoWeek(date: dayjs.Dayjs | string): string {
  const value = dayjs(date);
  const week = String(value.isoWeek()).padStart(2, '0');
  return `${value.isoWeekYear()}-W${week}`;
}

/** The Monday that starts the given `YYYY-Www` week. */
export function isoWeekStart(week: string): dayjs.Dayjs {
  const [year, weekNumber] = week.split('-W');
  // Anchor mid-year before setting the week: on a boundary date the isoWeekYear
  // and calendar year disagree, which would shift the result by a year.
  return dayjs(`${year}-06-15`).isoWeek(Number(weekNumber)).startOf('isoWeek');
}

/** Shift a `YYYY-Www` week by a number of weeks, returning the same format. */
export function addIsoWeeks(week: string, amount: number): string {
  return toIsoWeek(isoWeekStart(week).add(amount, 'week'));
}

/** The ISO week containing today. */
export function currentIsoWeek(): string {
  return toIsoWeek(dayjs());
}

/** Human label for a week, e.g. `Aug 10 – 16, 2026`. */
export function formatIsoWeekLabel(week: string): string {
  const start = isoWeekStart(week);
  const end = start.add(6, 'day');

  // Collapse the repeated month and year when the week doesn't straddle them.
  if (start.isSame(end, 'month')) {
    return `${start.format('MMM D')} – ${end.format('D, YYYY')}`;
  }
  if (start.isSame(end, 'year')) {
    return `${start.format('MMM D')} – ${end.format('MMM D, YYYY')}`;
  }
  return `${start.format('MMM D, YYYY')} – ${end.format('MMM D, YYYY')}`;
}
