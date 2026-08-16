import type { GitStats, GitStatsByDay, GitStatsTotals } from '../../../types/api';

/**
 * Synthetic git activity for demo mode.
 *
 * The real service shells out to `git log` in each project directory. Demo
 * projects are plain directories with no history, so every dashboard stat came
 * back as zero — the streak, the sparklines, and the commit counts were all
 * empty in screenshots.
 *
 * Values are deterministic: each day is derived from its own date, so the shape
 * of the chart is identical on every run while still tracking the current week.
 */

/** Weekday activity profile, indexed by day of week (0 = Sunday). */
const COMMITS_BY_WEEKDAY = [1, 7, 5, 9, 6, 8, 2];
const FILES_PER_COMMIT = 3;
const LINES_ADDED_PER_COMMIT = 84;
const LINES_REMOVED_PER_COMMIT = 37;
const PROJECTS_BY_WEEKDAY = [1, 3, 2, 4, 3, 3, 1];

/**
 * Deterministic per-day jitter so the chart is not a flat repeating pattern.
 * Derived from the date string itself rather than a PRNG, so it never shifts
 * when unrelated code changes.
 */
function dateSeed(date: string): number {
  let hash = 0;
  for (const char of date) {
    hash = (hash * 31 + char.charCodeAt(0)) % 1000;
  }
  return hash;
}

function buildDay(date: string): GitStatsByDay {
  const weekday = new Date(`${date}T12:00:00`).getDay();
  const seed = dateSeed(date);

  // Keep weekends quiet, which is what a real contribution graph looks like.
  const base = COMMITS_BY_WEEKDAY[weekday] ?? 4;
  const commits = Math.max(0, base + (seed % 3) - 1);

  if (commits === 0) {
    return {
      date,
      commits: 0,
      filesChanged: 0,
      linesAdded: 0,
      linesRemoved: 0,
      projectsWorkedOn: 0,
    };
  }

  return {
    date,
    commits,
    filesChanged: commits * FILES_PER_COMMIT + (seed % 5),
    linesAdded: commits * LINES_ADDED_PER_COMMIT + (seed % 60),
    linesRemoved: commits * LINES_REMOVED_PER_COMMIT + (seed % 25),
    projectsWorkedOn: Math.min(PROJECTS_BY_WEEKDAY[weekday] ?? 2, commits),
  };
}

/**
 * Build demo stats for the dates the caller asked about, so the response always
 * lines up with the requested period.
 */
export function buildDemoGitStats(
  period: 'week' | 'month' | 'last-week',
  dates: string[]
): GitStats {
  // Days after "now" are left empty so a partial week tapers off rather than
  // showing commits dated in the future.
  //
  // "Now" is the last day of the requested range rather than the calendar date:
  // the app's week runs Monday-Sunday via dayjs().day(1), which on a Sunday
  // resolves to the *upcoming* Monday, putting the whole range in the future.
  // Anchoring to the range keeps the dashboard populated whichever day a
  // screenshot is captured.
  const calendarToday = new Date().toISOString().slice(0, 10);
  const lastDate = dates[dates.length - 1] ?? calendarToday;
  const cutoff = calendarToday < (dates[0] ?? calendarToday) ? lastDate : calendarToday;

  const days = dates.map(date =>
    date > cutoff
      ? { date, commits: 0, filesChanged: 0, linesAdded: 0, linesRemoved: 0, projectsWorkedOn: 0 }
      : buildDay(date)
  );

  const totals: GitStatsTotals = {
    commits: days.reduce((sum, day) => sum + day.commits, 0),
    filesChanged: days.reduce((sum, day) => sum + day.filesChanged, 0),
    linesAdded: days.reduce((sum, day) => sum + day.linesAdded, 0),
    linesRemoved: days.reduce((sum, day) => sum + day.linesRemoved, 0),
    projectsWorkedOn: Math.max(...days.map(day => day.projectsWorkedOn), 0),
  };

  return { period, days, totals };
}
