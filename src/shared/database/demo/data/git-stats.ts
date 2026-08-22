import type {
  GitStats,
  GitStatsByDay,
  GitStatsDetail,
  GitStatsLanguageSlice,
  GitStatsPerProject,
  GitStatsRange,
  GitStatsTopFile,
  GitStatsTotals,
} from '../../../types/api';
import { calculateStreaks } from '../../../utils/git-streak';

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
 * Plausible-looking paths for the demo "most changed files" list. Fixed rather
 * than generated so screenshots stay byte-stable between runs.
 */
const DEMO_FILES = [
  'src/components/Dashboard.vue',
  'src/lib/api-client.ts',
  'src/routes/projects.ts',
  'src/styles/theme.css',
  'src/components/ProjectCard.vue',
  'src/services/sync-service.ts',
  'README.md',
  'src/utils/format.ts',
  'src/components/Sidebar.vue',
  'src/db/schema.ts',
];

/** Extension -> demo language identity, matching the real detector slugs. */
const DEMO_LANGUAGES: Record<string, { slug: string; label: string; color: string }> = {
  '.vue': { slug: 'vue', label: 'Vue', color: '#42B883' },
  '.ts': { slug: 'typescript', label: 'TypeScript', color: '#3178C6' },
  '.css': { slug: 'css', label: 'CSS', color: '#1572B6' },
};

export interface BuildDemoGitStatsOptions {
  period: GitStats['period'];
  range: GitStatsRange;
  dates: string[];
  detail?: boolean;
  projectPaths?: string[];
}

/**
 * Build demo stats for the dates the caller asked about, so the response always
 * lines up with the requested period.
 */
export function buildDemoGitStats(options: BuildDemoGitStatsOptions): GitStats {
  const { period, range, dates, detail = false } = options;

  // Days after "now" are left empty so a partial week tapers off rather than
  // showing commits dated in the future.
  //
  // "Now" is the last day of the requested range rather than the calendar date:
  // the app's week runs Monday-Sunday via dayjs().day(1), which on a Sunday
  // resolves to the *upcoming* Monday, putting the whole range in the future.
  // Anchoring to the range keeps the dashboard populated whichever day a
  // screenshot is captured.
  //
  // A wholly historical range (any past month) falls through untouched, so
  // stepping back through the Stats page shows a fully populated month.
  const calendarToday = new Date().toISOString().slice(0, 10);
  const lastDate = dates[dates.length - 1] ?? calendarToday;
  const cutoff = calendarToday < (dates[0] ?? calendarToday) ? lastDate : calendarToday;

  const days = dates.map(date =>
    date > cutoff
      ? { date, commits: 0, filesChanged: 0, linesAdded: 0, linesRemoved: 0, projectsWorkedOn: 0 }
      : buildDay(date)
  );

  const linesAdded = days.reduce((sum, day) => sum + day.linesAdded, 0);
  const linesRemoved = days.reduce((sum, day) => sum + day.linesRemoved, 0);

  const totals: GitStatsTotals = {
    commits: days.reduce((sum, day) => sum + day.commits, 0),
    // Distinct files over the range. The real service counts a file edited on
    // several days once, so approximate rather than summing the per-day counts.
    filesChanged: Math.round(days.reduce((sum, day) => sum + day.filesChanged, 0) * 0.4),
    linesAdded,
    linesRemoved,
    projectsWorkedOn: Math.max(...days.map(day => day.projectsWorkedOn), 0),
    netLines: linesAdded - linesRemoved,
    churn: linesAdded + linesRemoved,
    activeDays: days.filter(day => day.commits > 0).length,
  };

  const stats: GitStats = { period, range, days, totals };
  if (detail) stats.detail = buildDemoDetail(days, totals, range, options.projectPaths ?? []);
  return stats;
}

/**
 * Split the period's totals across the demo projects, so the "most active
 * projects" card has a plausible ranking rather than an empty state.
 */
function buildDemoPerProject(totals: GitStatsTotals, projectPaths: string[]): GitStatsPerProject[] {
  // Only a few projects are worked on in any period; a list where every project
  // is equally busy looks staged.
  const active = projectPaths.slice(0, Math.min(5, projectPaths.length));
  if (active.length === 0 || totals.commits === 0) return [];

  const weights = active.map((_, index) => 1 / (index + 1.4));
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);

  return active.map((projectPath, index) => {
    const share = weights[index] / weightTotal;
    return {
      projectPath,
      commits: Math.max(1, Math.round(totals.commits * share)),
      filesChanged: Math.max(1, Math.round(totals.filesChanged * share)),
      linesAdded: Math.round(totals.linesAdded * share),
      linesRemoved: Math.round(totals.linesRemoved * share),
    };
  });
}

/** Deterministic top files, languages and highlights for the Stats page. */
function buildDemoDetail(
  days: GitStatsByDay[],
  totals: GitStatsTotals,
  range: GitStatsRange,
  projectPaths: string[]
): GitStatsDetail {
  const topFiles: GitStatsTopFile[] = DEMO_FILES.map((file, index) => {
    // Decay down the list so the bars form a natural-looking ramp.
    const weight = 1 / (index + 1.6);
    const changes = Math.max(4, Math.round(totals.churn * weight * 0.16));
    const added = Math.round(changes * 0.68);
    return {
      path: file,
      changes,
      linesAdded: added,
      linesRemoved: changes - added,
      commits: Math.max(1, Math.round(totals.commits * weight * 0.14)),
    };
  }).filter(file => file.changes > 0);

  const byLanguage = new Map<string, GitStatsLanguageSlice>();
  for (const file of topFiles) {
    const ext = file.path.slice(file.path.lastIndexOf('.'));
    const language = DEMO_LANGUAGES[ext];
    const slug = language?.slug ?? 'other';

    let slice = byLanguage.get(slug);
    if (!slice) {
      slice = {
        slug,
        label: language?.label ?? 'Other',
        ...(language ? { color: language.color } : {}),
        linesChanged: 0,
        filesChanged: 0,
        percentage: 0,
      };
      byLanguage.set(slug, slice);
    }
    slice.linesChanged += file.changes;
    slice.filesChanged += 1;
  }

  const languageTotal = [...byLanguage.values()].reduce((sum, s) => sum + s.linesChanged, 0);
  const languages = [...byLanguage.values()]
    .map(slice => ({
      ...slice,
      percentage: languageTotal ? Math.round((slice.linesChanged / languageTotal) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.linesChanged - a.linesChanged);

  const busiest = days.reduce<GitStatsByDay | null>(
    (best, day) => (day.commits > 0 && (!best || day.commits > best.commits) ? day : best),
    null
  );

  return {
    topFiles,
    languages,
    busiestDay: busiest ? { date: busiest.date, commits: busiest.commits } : null,
    perProject: buildDemoPerProject(totals, projectPaths),
    streaks: calculateStreaks(days, range.until),
  };
}
