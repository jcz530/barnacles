import type {
  GitStats,
  GitStatsLanguageSlice,
  GitStatsPerProject,
  ProjectWithDetails,
} from '../types/api';
import { bucketByIsoWeek, type DatedValue } from '../utils/iso-week';

/**
 * The single derivation between raw git stats and anything shareable.
 *
 * Both outputs — the PNG card and the plain-text summary — consume `ShareModel`
 * and nothing else. Neither can see `GitStats`, so a value shown on the card and
 * the same value in the text cannot disagree, and a privacy toggle honored here
 * is honored in both by construction.
 */

export type ShareStatKey =
  | 'streak'
  | 'commits'
  | 'filesChanged'
  | 'projects'
  | 'linesAdded'
  | 'linesRemoved'
  | 'netLines'
  | 'churn'
  | 'activeDays'
  | 'avgPerActiveDay'
  | 'busiestDay';

export type ShareTemplate = 'recap' | 'streak' | 'breakdown' | 'custom';

export type ShareSize = 'og' | 'square';

export type Granularity = 'week' | 'month' | 'year';

export interface ShareOptions {
  template: ShareTemplate;
  statKeys: ShareStatKey[];
  anonymizeProjects: boolean;
  size: ShareSize;
}

export interface ShareContext {
  periodLabel: string;
  granularity: Granularity;
  /** Project paths currently filtered on; empty means every project. */
  selectedProjects: string[];
  /** Used to resolve a repo path to its display name. */
  allProjects: Pick<ProjectWithDetails, 'path' | 'name'>[];
}

export interface ShareStat {
  key: ShareStatKey;
  label: string;
  value: string;
  rawValue: number;
  tone?: 'success' | 'danger' | 'neutral';
}

export interface ShareProject {
  name: string;
  commits: number;
  /** Share of the period's commits, 0-100. */
  share: number;
}

export interface ShareLanguage {
  label: string;
  percentage: number;
  color?: string;
}

export interface ShareModel {
  periodLabel: string;
  granularity: Granularity;
  scopeLabel: string;
  stats: ShareStat[];
  /** One value per day, or per ISO week in year mode. Already normalized. */
  sparkline: number[];
  /**
   * ISO date for each `sparkline` entry, same order and length.
   *
   * The card labels its bars — unlike the app's tiles, a shared image has no
   * hover to reveal anything — so it needs the dates the values came from.
   */
  sparklineDates: string[];
  projects: ShareProject[];
  languages: ShareLanguage[];
  /** True when the period has no commits at all. */
  isEmpty: boolean;
  attribution: string;
}

export const ATTRIBUTION = 'barnacles.app';

/**
 * The most stats any card layout holds.
 *
 * A backstop rather than the live limit: the share dialog clamps to the exact
 * capacity of the chosen design and size, which is never larger than this. Kept
 * so a caller that skips that clamp still gets a model the card can render.
 */
export const MAX_STATS = 6;

export const TEMPLATE_STATS: Record<Exclude<ShareTemplate, 'custom'>, ShareStatKey[]> = {
  recap: ['commits', 'streak', 'activeDays', 'linesAdded', 'linesRemoved', 'projects'],
  streak: ['streak', 'activeDays', 'commits', 'avgPerActiveDay'],
  breakdown: ['commits', 'filesChanged', 'linesAdded', 'linesRemoved'],
};

export const STAT_LABELS: Record<ShareStatKey, string> = {
  streak: 'Day streak',
  commits: 'Commits',
  filesChanged: 'Files changed',
  projects: 'Projects',
  linesAdded: 'Lines added',
  linesRemoved: 'Lines removed',
  netLines: 'Net lines',
  churn: 'Lines changed',
  activeDays: 'Active days',
  avgPerActiveDay: 'Commits / active day',
  busiestDay: 'Busiest day',
};

/**
 * Compact notation for card display: 24,132 -> "24.1k".
 *
 * The Stats page uses `toLocaleString()`, which is right for a wide tile but
 * overflows a fixed-width card, so the card and the text summary abbreviate
 * instead. Defined here so both use identical output.
 */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs < 1000) return String(value);

  const sign = value < 0 ? '-' : '';
  if (abs < 1_000_000) {
    const scaled = abs / 1000;
    // Drop the decimal once it stops adding information (9.9k, but 24k).
    return `${sign}${scaled < 10 ? scaled.toFixed(1) : Math.round(scaled)}k`;
  }
  const scaled = abs / 1_000_000;
  return `${sign}${scaled < 10 ? scaled.toFixed(1) : Math.round(scaled)}M`;
}

/** Resolve a repo path to its display name, falling back to the last segment. */
function displayName(path: string, byPath: Map<string, string>): string {
  return byPath.get(path) ?? path.slice(path.lastIndexOf('/') + 1);
}

/** `Barnacle A`, `Barnacle B`, … by rank. Deterministic, so both outputs match. */
function anonymousName(index: number): string {
  let label = '';
  let n = index;
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return `Barnacle ${label}`;
}

function buildScopeLabel(context: ShareContext, anonymize: boolean): string {
  const { selectedProjects, allProjects } = context;
  if (selectedProjects.length === 0) return 'All barnacles';
  if (selectedProjects.length === 1) {
    // The scope label names a single project outright, so it has to honour the
    // privacy toggle too — anonymizing the ranked list while captioning the
    // card with the real name would defeat the point.
    if (anonymize) return '1 barnacle';
    const byPath = new Map(allProjects.map(p => [p.path, p.name]));
    return displayName(selectedProjects[0], byPath);
  }
  return `${selectedProjects.length} barnacles`;
}

function buildStats(stats: GitStats, keys: ShareStatKey[]): ShareStat[] {
  const totals = stats.totals;
  const streaks = stats.detail?.streaks;
  const busiest = stats.detail?.busiestDay;
  const activeDays = totals.activeDays;

  const resolve = (key: ShareStatKey): ShareStat | null => {
    switch (key) {
      case 'streak': {
        // Prefer a running streak; a finished period only has a longest.
        const value = streaks ? (streaks.current > 0 ? streaks.current : streaks.longest) : 0;
        return { key, label: STAT_LABELS[key], value: String(value), rawValue: value };
      }
      case 'commits':
        return {
          key,
          label: STAT_LABELS[key],
          value: formatCompact(totals.commits),
          rawValue: totals.commits,
        };
      case 'filesChanged':
        return {
          key,
          label: STAT_LABELS[key],
          value: formatCompact(totals.filesChanged),
          rawValue: totals.filesChanged,
        };
      case 'projects':
        return {
          key,
          label: STAT_LABELS[key],
          value: String(totals.projectsWorkedOn),
          rawValue: totals.projectsWorkedOn,
        };
      case 'linesAdded':
        return {
          key,
          label: STAT_LABELS[key],
          value: formatCompact(totals.linesAdded),
          rawValue: totals.linesAdded,
          tone: 'success',
        };
      case 'linesRemoved':
        return {
          key,
          label: STAT_LABELS[key],
          value: formatCompact(totals.linesRemoved),
          rawValue: totals.linesRemoved,
          tone: 'danger',
        };
      case 'netLines':
        return {
          key,
          label: STAT_LABELS[key],
          value: formatCompact(totals.netLines),
          rawValue: totals.netLines,
          tone: totals.netLines < 0 ? 'danger' : 'success',
        };
      case 'churn':
        return {
          key,
          label: STAT_LABELS[key],
          value: formatCompact(totals.churn),
          rawValue: totals.churn,
        };
      case 'activeDays':
        return { key, label: STAT_LABELS[key], value: String(activeDays), rawValue: activeDays };
      case 'avgPerActiveDay': {
        const avg = activeDays ? totals.commits / activeDays : 0;
        return {
          key,
          label: STAT_LABELS[key],
          // A decimal is the point at everyday scale (7.4 commits a day), but
          // an unabbreviated four-digit average overflows the card's stat row,
          // so hand the large end to the same compact notation as everything else.
          value: activeDays ? (avg < 1000 ? avg.toFixed(1) : formatCompact(Math.round(avg))) : '—',
          rawValue: avg,
        };
      }
      case 'busiestDay':
        // Formatted as a date by the renderer; the raw ISO date is the value.
        return busiest
          ? {
              key,
              label: STAT_LABELS[key],
              value: busiest.date,
              rawValue: busiest.commits,
            }
          : null;
      default:
        return null;
    }
  };

  return keys.map(resolve).filter((stat): stat is ShareStat => stat !== null);
}

function buildProjects(
  perProject: GitStatsPerProject[],
  context: ShareContext,
  anonymize: boolean,
  limit: number
): ShareProject[] {
  const byPath = new Map(context.allProjects.map(p => [p.path, p.name]));
  const total = perProject.reduce((sum, p) => sum + p.commits, 0);

  return perProject.slice(0, limit).map((project, index) => ({
    name: anonymize ? anonymousName(index) : displayName(project.projectPath, byPath),
    commits: project.commits,
    share: total ? Math.round((project.commits / total) * 100) : 0,
  }));
}

function buildLanguages(languages: GitStatsLanguageSlice[], limit: number): ShareLanguage[] {
  return languages.slice(0, limit).map(language => ({
    label: language.label,
    percentage: Math.round(language.percentage),
    color: language.color,
  }));
}

/**
 * Daily commit counts, bucketed to ISO weeks for a year.
 *
 * 365 glyphs is unusable in a text summary and unreadable on a card, so a year
 * collapses to ~52 weekly values — the same trade the Stats tiles make.
 */
function buildSparkline(stats: GitStats, granularity: Granularity): DatedValue[] {
  const entries: DatedValue[] = stats.days.map(day => ({ date: day.date, value: day.commits }));
  return granularity === 'year'
    ? bucketByIsoWeek(entries, values => values.reduce((sum, value) => sum + value, 0))
    : entries;
}

export function buildShareModel(
  stats: GitStats,
  options: ShareOptions,
  context: ShareContext
): ShareModel {
  const anonymize = options.anonymizeProjects;
  const sparkline = buildSparkline(stats, context.granularity);
  // The square card is taller, so it has room for more list rows.
  const listLimit = options.size === 'square' ? 5 : 3;

  return {
    periodLabel: context.periodLabel,
    granularity: context.granularity,
    scopeLabel: buildScopeLabel(context, anonymize),
    stats: buildStats(stats, options.statKeys.slice(0, MAX_STATS)),
    sparkline: sparkline.map(entry => entry.value),
    sparklineDates: sparkline.map(entry => entry.date),
    projects: buildProjects(stats.detail?.perProject ?? [], context, anonymize, listLimit),
    languages: buildLanguages(stats.detail?.languages ?? [], listLimit),
    isEmpty: stats.totals.commits === 0,
    attribution: ATTRIBUTION,
  };
}
