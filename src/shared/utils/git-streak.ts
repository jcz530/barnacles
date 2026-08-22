/**
 * Streak math over daily git activity.
 *
 * Lives in `shared` because both ends need it: the frontend renders a live
 * "current streak" on the dashboard, and the backend reports the longest streak
 * in a month's stats payload. Keeping one implementation means the two can't
 * disagree about what a streak is.
 *
 * Deliberately free of dayjs. `shared` is compiled by all three tsconfig
 * projects, and plain UTC date arithmetic on `YYYY-MM-DD` strings is enough —
 * these dates are calendar days with no time component, so timezone-aware date
 * handling would add a dependency without adding correctness.
 */

/** The subset of a day's stats that streak math needs. */
export interface StreakDay {
  date: string; // YYYY-MM-DD
  commits: number;
}

export interface StreakResult {
  /**
   * Consecutive active days ending today or yesterday, counting backwards.
   * Zero when the most recent activity is older than yesterday, and zero for a
   * range that doesn't reach the present — see `anchorDate`.
   */
  current: number;
  /** Longest run of consecutive active days anywhere in the range. */
  longest: number;
  /** Bounds of the longest run, omitted when there is no activity at all. */
  longestStart?: string;
  longestEnd?: string;
  /**
   * True when the streak is alive but today has no commits yet — the dashboard
   * uses this to warn that the streak is about to lapse.
   */
  warning: boolean;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Parse `YYYY-MM-DD` as UTC midnight, avoiding local-timezone drift. */
function toUtcDay(date: string): number {
  return Date.parse(`${date}T00:00:00Z`);
}

/** Whole days from `from` to `to`; negative when `to` precedes `from`. */
function daysBetween(from: string, to: string): number {
  return Math.round((toUtcDay(to) - toUtcDay(from)) / MS_PER_DAY);
}

/** Today in `YYYY-MM-DD`, in the user's local timezone. */
export function todayIsoDate(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Compute current and longest streaks from daily activity.
 *
 * `anchorDate` is what "current" is measured against — it defaults to today,
 * but the backend passes the end of the requested range so that asking about a
 * past month doesn't report a current streak that only makes sense relative to
 * now. When the anchor isn't today, `current` is always 0: a streak that ended
 * in March isn't running.
 *
 * Input need not be sorted, and days with zero commits may be present or
 * absent — only active days affect the result.
 */
export function calculateStreaks(days: StreakDay[], anchorDate?: string): StreakResult {
  const empty: StreakResult = { current: 0, longest: 0, warning: false };
  if (!days || days.length === 0) return empty;

  // Dedupe by date as well as sort: callers merge per-project data, so the same
  // day can legitimately appear more than once and would otherwise inflate a run.
  const activeDates = [...new Set(days.filter(d => d.commits > 0).map(d => d.date))].sort();
  if (activeDates.length === 0) return empty;

  // Longest run of consecutive calendar days.
  let longest = 1;
  let longestEnd = activeDates[0];
  let runLength = 1;

  for (let i = 1; i < activeDates.length; i++) {
    runLength = daysBetween(activeDates[i - 1], activeDates[i]) === 1 ? runLength + 1 : 1;
    if (runLength > longest) {
      longest = runLength;
      longestEnd = activeDates[i];
    }
  }

  const longestStart = activeDates[activeDates.indexOf(longestEnd) - (longest - 1)];

  // "Current" only means something when the range reaches the present day.
  const anchor = anchorDate ?? todayIsoDate();
  const today = todayIsoDate();
  if (anchor !== today) {
    return { current: 0, longest, longestStart, longestEnd, warning: false };
  }

  const mostRecent = activeDates[activeDates.length - 1];
  const daysSince = daysBetween(mostRecent, today);

  // A commit today keeps the streak; a commit yesterday keeps it but warns.
  // Anything older has already broken it. Future dates (negative) can appear
  // when a commit carries a skewed author date — treat them as today.
  if (daysSince > 1) {
    return { current: 0, longest, longestStart, longestEnd, warning: false };
  }

  let current = 1;
  for (let i = activeDates.length - 1; i > 0; i--) {
    if (daysBetween(activeDates[i - 1], activeDates[i]) !== 1) break;
    current++;
  }

  return { current, longest, longestStart, longestEnd, warning: daysSince === 1 };
}
