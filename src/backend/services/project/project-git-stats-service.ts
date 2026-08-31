import { execFile } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import isoWeeksInYear from 'dayjs/plugin/isoWeeksInYear';
import isLeapYear from 'dayjs/plugin/isLeapYear';
import type {
  GitStats,
  GitStatsByDay,
  GitStatsDetail,
  GitStatsLanguageSlice,
  GitStatsPerProject,
  GitStatsRange,
  GitStatsTopFile,
  GitStatsTotals,
} from '@shared/types/api';
// Relative rather than the @shared alias: this is a runtime import, and the
// alias is only resolved by tsconfig, not by the main process's vite build.
import { calculateStreaks, todayIsoDate } from '../../../shared/utils/git-streak';
import { isDemoMode } from '../../../shared/config/runtime-mode';
import { TECHNOLOGY_DETECTORS } from '../technology-detectors';
import { getGitCommonDir } from './project-worktrees-service';

// ISO weeks run Monday-Sunday and are what the `week=YYYY-Www` param addresses.
// isoWeeksInYear needs isLeapYear, and it is what tells a 53-week year from a
// 52-week one when validating a requested week.
dayjs.extend(isoWeek);
dayjs.extend(isLeapYear);
dayjs.extend(isoWeeksInYear);

// execFile rather than exec: author emails come from user settings and would
// otherwise be interpolated into a shell string. An argv array is never
// shell-parsed, so a quote or semicolon in an email is just a character.
const execFileAsync = promisify(execFile);

// `git log --numstat` over a busy month across a large repo comfortably exceeds
// the 1MB default, and an overflow rejects into the catch below — which would
// silently report the project as having no activity.
const GIT_MAX_BUFFER = 32 * 1024 * 1024;

const MAX_TOP_FILES = 20;
const PROJECT_CONCURRENCY = 8;

interface FileAggregate {
  linesAdded: number;
  linesRemoved: number;
  commits: number;
}

interface DailyProjectData {
  commits: number;
  files: Set<string>;
  linesAdded: number;
  linesRemoved: number;
}

interface ProjectGitData {
  daily: Map<string, DailyProjectData>;
  /** Repo-relative path -> totals for the whole range. */
  files: Map<string, FileAggregate>;
}

// Files to exclude from line count stats
const EXCLUDED_FILES = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'Gemfile.lock',
  'Cargo.lock',
  'composer.lock',
  'poetry.lock',
  'Pipfile.lock',
];

/**
 * Extension -> technology slug, built once from the same detector list the
 * project scanner uses, so a language means the same thing in both places.
 * Detectors store extensions with a leading dot, matching `path.extname`.
 * First detector wins, mirroring the scanner's precedence.
 */
const EXTENSION_TO_TECHNOLOGY = (() => {
  const map = new Map<string, { slug: string; label: string; color?: string }>();
  for (const detector of TECHNOLOGY_DETECTORS) {
    for (const ext of detector.fileExtensions ?? []) {
      const key = ext.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { slug: detector.slug, label: detector.name, color: detector.color });
      }
    }
  }
  return map;
})();

interface GitStatsCacheEntry {
  at: number;
  value: GitStats;
}

/**
 * Past months can't change (barring a history rewrite), so their results are
 * cached until the process restarts. The current period is re-read after a
 * short TTL so new commits show up without a restart.
 */
const CURRENT_PERIOD_TTL_MS = 5 * 60 * 1000;
/**
 * The key space is two-dimensional — every period the user visits is cached
 * once per distinct project selection — so it grows faster than the number of
 * periods alone suggests. Comparing three filter selections across two years of
 * months is already ~72 entries, and the frontend's own query cache absorbs the
 * trivial repeats, so what reaches this cache is the expensive misses. Each one
 * costs a `git log` per project, while an entry is only single-digit KB (a year
 * view with full detail is ~40KB), which makes a bigger ceiling the cheap side
 * of the trade.
 */
export const MAX_CACHE_ENTRIES = 150;

export interface GetGitStatsOptions {
  projectPaths: string[];
  /** Ignored when `week`, `month` or `year` is set. */
  period?: 'week' | 'month' | 'last-week';
  /** YYYY. Lowest precedence of the explicit ranges. */
  year?: string;
  /** YYYY-MM. Takes precedence over `year`. */
  month?: string;
  /** YYYY-Www (ISO week, Monday-Sunday). Takes precedence over `month`. */
  week?: string;
  additionalEmails?: string[];
  /** Include top files, languages, per-project and streak blocks. */
  detail?: boolean;
}

/** Parse `YYYY-Www` into the dayjs instance for that ISO week's Monday. */
export function parseIsoWeek(week: string): dayjs.Dayjs {
  const [year, weekNumber] = week.split('-W');
  // isoWeekYear differs from the calendar year in the first/last days of a
  // year, so anchor on a mid-year date before setting the week.
  return dayjs(`${year}-06-15`).isoWeek(Number(weekNumber)).startOf('isoWeek');
}

/** How many ISO weeks a year has — 52, or 53 for a long year. */
export function isoWeeksInYearFor(year: number): number {
  return dayjs(`${year}-06-15`).isoWeeksInYear();
}

/** Run an async mapper over items with a ceiling on in-flight work. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]);
    }
  });

  await Promise.all(workers);
  return results;
}

class ProjectGitStatsService {
  private cache = new Map<string, GitStatsCacheEntry>();

  /**
   * Aggregate git stats across projects, grouped by day.
   *
   * Pass `week` for an ISO week, `month` for a calendar month, or `period` for
   * the dashboard's rolling windows.
   */
  async getGitStats(options: GetGitStatsOptions): Promise<GitStats> {
    const { projectPaths, month, week, year, detail = false } = options;
    const period = week
      ? ('custom-week' as const)
      : month
        ? ('custom-month' as const)
        : year
          ? ('custom-year' as const)
          : (options.period ?? 'week');
    const additionalEmails = options.additionalEmails ?? [];

    const { since, until, gridUntil } = this.resolveRange(options);
    // Only the winning range echoes back, so a caller can tell which one applied.
    const range: GitStatsRange = {
      since,
      until,
      ...(week ? { week } : {}),
      ...(month && !week ? { month } : {}),
      ...(year && !week && !month ? { year } : {}),
    };

    const cacheKey = JSON.stringify({
      period,
      month,
      week,
      year,
      detail,
      projectPaths: [...projectPaths].sort(),
      emails: [...additionalEmails].sort(),
    });
    const cached = this.readCache(cacheKey, gridUntil);
    if (cached) return cached;

    // Demo projects are plain directories with no git history, so the real
    // `git log` path returns zeros for every stat. Serve synthetic activity
    // instead, using the same date range the caller asked for.
    if (isDemoMode()) {
      const { buildDemoGitStats } = await import('../../../shared/database/demo/data/git-stats');
      return buildDemoGitStats({
        period,
        range,
        dates: this.getDateRange(since, gridUntil),
        detail,
        projectPaths,
      });
    }

    const globalEmail = await this.getGlobalEmail();
    const baseEmails = new Set<string>();
    if (globalEmail) baseEmails.add(globalEmail);
    additionalEmails.forEach(email => baseEmails.add(email));

    // Every day in the range, so the heatmap and sparklines keep their shape
    // even where there was no activity.
    const allDates = this.getDateRange(since, gridUntil);
    const dailyStatsMap = new Map<string, DailyProjectData>();
    allDates.forEach(date => {
      dailyStatsMap.set(date, {
        commits: 0,
        files: new Set<string>(),
        linesAdded: 0,
        linesRemoved: 0,
      });
    });

    // `git log --all` reads the shared object store, so two checkouts of one
    // repository return the identical commits -- scanning both would double every
    // number. Collapse to one path per repository first.
    const distinctPaths = await this.dedupeByRepository(projectPaths);

    const collected = await mapWithConcurrency(
      distinctPaths,
      PROJECT_CONCURRENCY,
      async projectPath => {
        // A repo may override the author email locally, so resolve per project
        // rather than sharing one mutable set across all of them.
        const localEmail = await this.getProjectLocalEmail(projectPath);
        const emails = new Set(baseEmails);
        if (localEmail) emails.add(localEmail);

        const data = await this.getProjectGitData(projectPath, [...emails], since, until);
        return { projectPath, data };
      }
    );

    const projectsByDay = new Map<string, Set<string>>();
    const allProjects = new Set<string>();
    // Period-wide distinct files, namespaced by repo so identical relative
    // paths in different projects stay distinct.
    const allFiles = new Set<string>();
    const topFiles = new Map<string, GitStatsTopFile>();
    const perProject: GitStatsPerProject[] = [];

    for (const { projectPath, data } of collected) {
      if (!data) continue;

      const projectTotals: GitStatsPerProject = {
        projectPath,
        commits: 0,
        filesChanged: data.files.size,
        linesAdded: 0,
        linesRemoved: 0,
      };

      data.daily.forEach((dayData, date) => {
        const existing = dailyStatsMap.get(date);
        // A commit can fall outside the grid when its author date is skewed;
        // `--since/--until` filter on that same date, so this is rare but real.
        if (!existing) return;

        existing.commits += dayData.commits;
        existing.linesAdded += dayData.linesAdded;
        existing.linesRemoved += dayData.linesRemoved;
        dayData.files.forEach(file => {
          existing.files.add(file);
          allFiles.add(`${projectPath} ${file}`);
        });

        projectTotals.commits += dayData.commits;
        projectTotals.linesAdded += dayData.linesAdded;
        projectTotals.linesRemoved += dayData.linesRemoved;

        if (dayData.commits > 0) {
          if (!projectsByDay.has(date)) projectsByDay.set(date, new Set());
          projectsByDay.get(date)!.add(projectPath);
          allProjects.add(projectPath);
        }
      });

      if (projectTotals.commits > 0) perProject.push(projectTotals);

      if (detail) {
        data.files.forEach((aggregate, file) => {
          topFiles.set(`${projectPath} ${file}`, {
            path: file,
            projectPath,
            changes: aggregate.linesAdded + aggregate.linesRemoved,
            linesAdded: aggregate.linesAdded,
            linesRemoved: aggregate.linesRemoved,
            commits: aggregate.commits,
          });
        });
      }
    }

    const days: GitStatsByDay[] = allDates.map(date => {
      const data = dailyStatsMap.get(date)!;
      return {
        date,
        commits: data.commits,
        filesChanged: data.files.size,
        linesAdded: data.linesAdded,
        linesRemoved: data.linesRemoved,
        projectsWorkedOn: projectsByDay.get(date)?.size ?? 0,
      };
    });

    const totals = this.buildTotals(days, allFiles.size, allProjects.size);
    const stats: GitStats = { period, range, days, totals };

    if (detail) {
      stats.detail = this.buildDetail(days, topFiles, perProject, until);
    }

    this.writeCache(cacheKey, stats);
    return stats;
  }

  private buildTotals(
    days: GitStatsByDay[],
    distinctFiles: number,
    projectsWorkedOn: number
  ): GitStatsTotals {
    const linesAdded = days.reduce((sum, day) => sum + day.linesAdded, 0);
    const linesRemoved = days.reduce((sum, day) => sum + day.linesRemoved, 0);

    return {
      commits: days.reduce((sum, day) => sum + day.commits, 0),
      filesChanged: distinctFiles,
      linesAdded,
      linesRemoved,
      projectsWorkedOn,
      netLines: linesAdded - linesRemoved,
      churn: linesAdded + linesRemoved,
      activeDays: days.filter(day => day.commits > 0).length,
    };
  }

  private buildDetail(
    days: GitStatsByDay[],
    topFiles: Map<string, GitStatsTopFile>,
    perProject: GitStatsPerProject[],
    until: string
  ): GitStatsDetail {
    const sortedFiles = [...topFiles.values()]
      .sort((a, b) => b.changes - a.changes || a.path.localeCompare(b.path))
      .slice(0, MAX_TOP_FILES);

    const busiest = days.reduce<GitStatsByDay | null>((best, day) => {
      if (day.commits === 0) return best;
      // Ties resolve to the earliest day, so the value is stable run to run.
      return !best || day.commits > best.commits ? day : best;
    }, null);

    return {
      topFiles: sortedFiles,
      languages: this.buildLanguages(topFiles),
      busiestDay: busiest ? { date: busiest.date, commits: busiest.commits } : null,
      perProject: perProject.sort((a, b) => b.commits - a.commits),
      streaks: calculateStreaks(days, until),
    };
  }

  /**
   * Attribute changed lines to languages by file extension.
   *
   * Note this measures the code touched in the range, not the composition of
   * the codebase on disk — that is what the project scanner reports.
   */
  private buildLanguages(topFiles: Map<string, GitStatsTopFile>): GitStatsLanguageSlice[] {
    const byslug = new Map<string, GitStatsLanguageSlice>();

    for (const file of topFiles.values()) {
      const ext = path.extname(file.path).toLowerCase();
      const tech = EXTENSION_TO_TECHNOLOGY.get(ext);
      // Unrecognised extensions are bucketed rather than dropped, so the
      // percentages describe everything that changed.
      const slug = tech?.slug ?? 'other';

      let slice = byslug.get(slug);
      if (!slice) {
        slice = {
          slug,
          label: tech?.label ?? 'Other',
          ...(tech?.color ? { color: tech.color } : {}),
          linesChanged: 0,
          filesChanged: 0,
          percentage: 0,
        };
        byslug.set(slug, slice);
      }

      slice.linesChanged += file.changes;
      slice.filesChanged += 1;
    }

    const total = [...byslug.values()].reduce((sum, slice) => sum + slice.linesChanged, 0);
    if (total === 0) return [];

    return [...byslug.values()]
      .map(slice => ({
        ...slice,
        percentage: Math.round((slice.linesChanged / total) * 1000) / 10,
      }))
      .sort((a, b) => b.linesChanged - a.linesChanged);
  }

  private readCache(key: string, rangeEnd: string): GitStats | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // A range that has already ended is immutable; anything touching today is
    // only trusted briefly.
    const isHistorical = rangeEnd < todayIsoDate();
    if (!isHistorical && Date.now() - entry.at > CURRENT_PERIOD_TTL_MS) {
      this.cache.delete(key);
      return null;
    }

    // Re-insert so eviction is least-recently-*used* rather than least-recently
    // written. Map preserves insertion order, so deleting and re-setting moves
    // this entry to the newest position. Without it, paging back and forth over
    // more periods than the cache holds evicts the entries being actively
    // revisited, and every miss re-runs `git log` once per project.
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  private writeCache(key: string, value: GitStats): void {
    // Bounded so stepping back through years of history can't grow unchecked.
    // Reads refresh position (see readCache), so the entry dropped here is the
    // least recently used, not merely the oldest written.
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      const oldest = this.cache.keys().next();
      if (!oldest.done) this.cache.delete(oldest.value);
    }
    this.cache.set(key, { at: Date.now(), value });
  }

  /** Drop cached results, e.g. after a rescan changes what projects exist. */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Read one project's log for the range, grouped by day and by file.
   *
   * Both groupings come from a single `git log` invocation — the file totals
   * that feed top-files and languages are free once we're already parsing
   * numstat output.
   */
  /**
   * One path per repository.
   *
   * Identity is the shared git directory, so every checkout of a repo collapses
   * to a single entry while independent clones of the same remote stay separate.
   *
   * The surviving path must not depend on input order: callers pass projects
   * ordered by lastModified, which changes as the user works, while the cache
   * key is built from a sorted copy -- so an order-dependent winner would let a
   * cache hit return stats computed against a different checkout. That matters
   * because the winner is user-visible (reported as `perProject.projectPath`)
   * and carries attribution (a checkout can override user.email locally).
   *
   * Prefers a repository's main checkout, which is the path a user recognises,
   * falling back to the lexicographically first so the choice is still stable
   * for a set of paths that contains no main checkout.
   *
   * A path whose repository cannot be resolved is kept as-is rather than
   * dropped: it may still be a directory worth reading.
   */
  private async dedupeByRepository(projectPaths: string[]): Promise<string[]> {
    const distinct: string[] = [];
    const bestByRepo = new Map<string, string>();

    for (const projectPath of [...projectPaths].sort()) {
      const commonDir = await getGitCommonDir(projectPath);

      if (!commonDir) {
        distinct.push(projectPath);
        continue;
      }

      const incumbent = bestByRepo.get(commonDir);
      if (!incumbent) {
        bestByRepo.set(commonDir, projectPath);
        continue;
      }

      // `<repo>/.git` is the common dir of the main checkout itself.
      const isMainCheckout = path.resolve(commonDir) === path.resolve(projectPath, '.git');
      if (isMainCheckout) {
        bestByRepo.set(commonDir, projectPath);
      }
    }

    return [...distinct, ...bestByRepo.values()];
  }

  private async getProjectGitData(
    projectPath: string,
    userEmails: string[],
    sinceDate: string,
    untilDate: string
  ): Promise<ProjectGitData | null> {
    try {
      await fs.access(path.join(projectPath, '.git'));

      const args = [
        'log',
        '--all',
        ...userEmails.map(email => `--author=${email}`),
        `--since=${sinceDate}T00:00:00`,
        // Without a time component git reads this as midnight, which drops
        // every commit made on the final day of the range.
        `--until=${untilDate}T23:59:59`,
        '--format=%as|%H',
        '--numstat',
      ];

      const { stdout: logOutput } = await execFileAsync('git', args, {
        cwd: projectPath,
        maxBuffer: GIT_MAX_BUFFER,
      });

      if (!logOutput.trim()) return null;

      const daily = new Map<string, DailyProjectData>();
      const files = new Map<string, FileAggregate>();
      const commitFiles = new Set<string>();
      let currentDate: string | null = null;

      for (const line of logOutput.split('\n')) {
        if (!line.trim()) continue;

        if (line.includes('|')) {
          const [date] = line.split('|');
          currentDate = date;
          commitFiles.clear();

          if (!daily.has(date)) {
            daily.set(date, {
              commits: 0,
              files: new Set<string>(),
              linesAdded: 0,
              linesRemoved: 0,
            });
          }
          daily.get(date)!.commits++;
          continue;
        }

        if (!currentDate) continue;

        const parts = line.trim().split('\t');
        if (parts.length !== 3) continue;

        const [added, removed, rawPath] = parts;
        // git marks binary files with '-' instead of a line count.
        if (added === '-' || removed === '-') continue;

        const file = this.normalizeRenamePath(rawPath);
        if (EXCLUDED_FILES.includes(path.basename(file))) continue;

        const linesAdded = parseInt(added, 10) || 0;
        const linesRemoved = parseInt(removed, 10) || 0;

        const dayData = daily.get(currentDate)!;
        dayData.linesAdded += linesAdded;
        dayData.linesRemoved += linesRemoved;
        dayData.files.add(file);

        const aggregate = files.get(file) ?? { linesAdded: 0, linesRemoved: 0, commits: 0 };
        aggregate.linesAdded += linesAdded;
        aggregate.linesRemoved += linesRemoved;
        // One commit touching a file several times still counts once.
        if (!commitFiles.has(file)) {
          aggregate.commits += 1;
          commitFiles.add(file);
        }
        files.set(file, aggregate);
      }

      return { daily, files };
    } catch (error) {
      // A missing .git is the common, expected case — projects need not be
      // repositories. Anything else means we're silently reporting zeros for a
      // real repo, which is worth a line in the log.
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code !== 'ENOENT') {
        console.warn(`git stats: skipping ${projectPath}:`, (error as Error)?.message ?? error);
      }
      return null;
    }
  }

  /**
   * Resolve git's rename notation to the file's new path.
   *
   * numstat writes renames as `old => new`, or with a brace form for a shared
   * prefix/suffix: `src/{old => new}/index.ts`. Left unhandled, these become
   * their own bogus entries at the top of the changed-files list.
   */
  private normalizeRenamePath(rawPath: string): string {
    if (!rawPath.includes('=>')) return rawPath;

    const braced = rawPath.replace(/\{[^{}]*?=>\s*([^{}]*?)\}/g, '$1');
    if (braced !== rawPath) {
      // The brace form can leave a doubled slash when one side is empty.
      return braced.replace(/\/{2,}/g, '/');
    }

    return rawPath.split('=>').pop()!.trim();
  }

  private async getGlobalEmail(): Promise<string> {
    try {
      const { stdout } = await execFileAsync('git', ['config', '--global', 'user.email']);
      return stdout.trim();
    } catch {
      return '';
    }
  }

  private async getProjectLocalEmail(projectPath: string): Promise<string> {
    try {
      const { stdout } = await execFileAsync('git', ['config', 'user.email'], {
        cwd: projectPath,
      });
      return stdout.trim();
    } catch {
      return '';
    }
  }

  /** All dates in a range, inclusive. */
  private getDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    let current = dayjs(startDate);
    const end = dayjs(endDate);

    while (current.isBefore(end) || current.isSame(end, 'day')) {
      dates.push(current.format('YYYY-MM-DD'));
      current = current.add(1, 'day');
    }

    return dates;
  }

  /**
   * Resolve the requested window.
   *
   * `until` bounds the git query; `gridUntil` bounds the day grid. They differ
   * for the current month: querying past today is pointless, but the heatmap
   * should still show the month's full shape with the remaining days empty.
   */
  private resolveRange(options: GetGitStatsOptions): {
    since: string;
    until: string;
    gridUntil: string;
  } {
    const today = dayjs();

    if (options.week) {
      // Monday through Sunday. Like the month branch, the grid keeps the full
      // seven days so a mid-week view doesn't change shape as the week fills in.
      const start = parseIsoWeek(options.week);
      const end = start.add(6, 'day');
      const queryEnd = end.isAfter(today, 'day') ? today : end;

      return {
        since: start.format('YYYY-MM-DD'),
        until: queryEnd.format('YYYY-MM-DD'),
        gridUntil: end.format('YYYY-MM-DD'),
      };
    }

    if (options.month) {
      const start = dayjs(`${options.month}-01`).startOf('month');
      const end = start.endOf('month');
      const queryEnd = end.isAfter(today, 'day') ? today : end;

      return {
        since: start.format('YYYY-MM-DD'),
        until: queryEnd.format('YYYY-MM-DD'),
        gridUntil: end.format('YYYY-MM-DD'),
      };
    }

    if (options.year) {
      const start = dayjs(`${options.year}-01-01`).startOf('year');
      const end = start.endOf('year');
      const queryEnd = end.isAfter(today, 'day') ? today : end;

      return {
        since: start.format('YYYY-MM-DD'),
        until: queryEnd.format('YYYY-MM-DD'),
        gridUntil: end.format('YYYY-MM-DD'),
      };
    }

    switch (options.period ?? 'week') {
      case 'last-week': {
        const lastMonday = today.day(1).subtract(7, 'day');
        const lastSunday = lastMonday.add(6, 'day');
        return {
          since: lastMonday.format('YYYY-MM-DD'),
          until: lastSunday.format('YYYY-MM-DD'),
          gridUntil: lastSunday.format('YYYY-MM-DD'),
        };
      }
      case 'month': {
        const firstDay = today.startOf('month');
        return {
          since: firstDay.format('YYYY-MM-DD'),
          until: today.format('YYYY-MM-DD'),
          gridUntil: today.format('YYYY-MM-DD'),
        };
      }
      case 'week':
      default: {
        // Monday-Sunday. The window runs to Sunday even mid-week, so the
        // sparkline keeps a stable seven-day shape.
        const monday = today.day(1);
        const sunday = monday.add(6, 'day');
        return {
          since: monday.format('YYYY-MM-DD'),
          until: sunday.format('YYYY-MM-DD'),
          gridUntil: sunday.format('YYYY-MM-DD'),
        };
      }
    }
  }
}

export const projectGitStatsService = new ProjectGitStatsService();
