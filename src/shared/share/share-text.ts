import type { ShareModel, ShareProject, ShareLanguage } from './share-model';
import { formatCompact } from './share-model';

/**
 * Plain-text rendering of a `ShareModel` — the paste-anywhere counterpart to
 * the PNG card.
 *
 * Every glyph here is chosen to survive being pasted into a client we don't
 * control: block elements for charts (no font dependency, no images), a
 * fullwidth plus and a true minus so the +/- lines align and neither is parsed
 * as a markdown list, and blank-line-separated blocks so nothing collapses.
 */

/** U+2581..U+2588. Index 0 is the shortest bar. */
const SPARK_GLYPHS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
const BAR_FILLED = '█';
const BAR_EMPTY = '░';
const BAR_WIDTH = 10;
const NAME_WIDTH = 14;

/** Fullwidth plus / true minus, so added and removed lines line up. */
const PLUS = '＋';
const MINUS = '−';

/**
 * Render values as a block-glyph sparkline.
 *
 * Scaled across the range of active values, so the shape of a quiet month
 * reads the same as a busy one. An all-zero series returns an empty string:
 * a row of identical bars implies activity that isn't there.
 */
export function renderSparkline(values: number[]): string {
  if (values.length === 0) return '';

  const active = values.filter(value => value > 0);
  if (active.length === 0) return '';

  const max = Math.max(...active);
  const min = Math.min(...active);
  // Scale across the observed range, not from zero: a month whose quietest day
  // is 8 commits should still show its quiet days as short bars rather than
  // pinning everything near the top. Index 0 is reserved for "no activity".
  const span = max - min;
  const top = SPARK_GLYPHS.length - 1;

  return values
    .map(value => {
      if (value <= 0) return SPARK_GLYPHS[0];
      if (span === 0) return SPARK_GLYPHS[top];
      const step = 1 + Math.round(((value - min) / span) * (top - 1));
      return SPARK_GLYPHS[step];
    })
    .join('');
}

/** A fixed-width percentage bar, e.g. `████░░░░░░`. */
export function renderBar(percentage: number, width = BAR_WIDTH): string {
  const clamped = Math.max(0, Math.min(100, percentage));
  const filled = Math.round((clamped / 100) * width);
  return BAR_FILLED.repeat(filled) + BAR_EMPTY.repeat(width - filled);
}

/** Pad or truncate to a common width so bars start at the same column. */
function padName(name: string, width = NAME_WIDTH): string {
  if (name.length > width) return `${name.slice(0, width - 1)}…`;
  return name.padEnd(width, ' ');
}

function renderRows(rows: Array<{ name: string; percentage: number }>): string[] {
  return rows.map(row => `${padName(row.name)} ${renderBar(row.percentage)} ${row.percentage}%`);
}

function projectRows(projects: ShareProject[]): string[] {
  return renderRows(projects.map(p => ({ name: p.name, percentage: p.share })));
}

function languageRows(languages: ShareLanguage[]): string[] {
  return renderRows(languages.map(l => ({ name: l.label, percentage: l.percentage })));
}

function statValue(model: ShareModel, key: string): number | undefined {
  return model.stats.find(stat => stat.key === key)?.rawValue;
}

/** Headline: what was done, over what scope. */
function headline(model: ShareModel): string {
  const commits = statValue(model, 'commits');
  const projects = statValue(model, 'projects');

  if (commits === undefined) return model.scopeLabel;
  const commitPart = `${formatCompact(commits)} commit${commits === 1 ? '' : 's'}`;
  if (projects === undefined || projects <= 1) return commitPart;
  return `${commitPart} across ${projects} projects`;
}

/** Streak / active-days / average line, omitting whatever wasn't selected. */
function activityLine(model: ShareModel): string {
  const parts: string[] = [];
  const streak = statValue(model, 'streak');
  const activeDays = statValue(model, 'activeDays');
  const avg = statValue(model, 'avgPerActiveDay');

  if (streak) parts.push(`🔥 ${streak}-day streak`);
  if (activeDays) parts.push(`${activeDays} active day${activeDays === 1 ? '' : 's'}`);
  if (avg) parts.push(`${avg.toFixed(1)} commits/day`);

  return parts.join(' · ');
}

/** Lines added/removed, aligned on the fullwidth signs. */
function linesLine(model: ShareModel): string {
  const added = statValue(model, 'linesAdded');
  const removed = statValue(model, 'linesRemoved');
  if (added === undefined && removed === undefined) return '';

  const parts: string[] = [];
  if (added !== undefined) parts.push(`${PLUS}${formatCompact(added)}`);
  if (removed !== undefined) parts.push(`${MINUS}${formatCompact(removed)}`);
  return `${parts.join(' / ')} lines`;
}

function header(model: ShareModel): string {
  return `Barnacles · ${model.periodLabel}`;
}

function emptySummary(model: ShareModel): string {
  return [header(model), '', `No commits in ${model.periodLabel}.`, '', model.attribution].join(
    '\n'
  );
}

/**
 * The full summary: header, headline, sparkline, activity, lines, and a
 * ranked block of projects (or languages when projects are anonymized to the
 * point of being uninteresting).
 */
export function renderShareText(model: ShareModel): string {
  if (model.isEmpty) return emptySummary(model);

  const blocks: string[] = [header(model)];

  const first = [headline(model), renderSparkline(model.sparkline)].filter(Boolean);
  blocks.push(first.join('\n'));

  const second = [activityLine(model), linesLine(model)].filter(Boolean);
  if (second.length) blocks.push(second.join('\n'));

  const rows = model.projects.length ? projectRows(model.projects) : languageRows(model.languages);
  if (rows.length) blocks.push(rows.join('\n'));

  blocks.push(model.attribution);

  return blocks.join('\n\n');
}

/**
 * A short variant that fits a 280-character limit.
 *
 * Drops the ranked block, which is the longest and least essential part —
 * the headline, shape, and streak are what make the post worth reading.
 */
export function renderShareTextCompact(model: ShareModel): string {
  if (model.isEmpty) return emptySummary(model);

  const blocks: string[] = [header(model)];

  const first = [headline(model), renderSparkline(model.sparkline)].filter(Boolean);
  blocks.push(first.join('\n'));

  const activity = activityLine(model);
  if (activity) blocks.push(activity);

  blocks.push(model.attribution);

  return blocks.join('\n\n');
}
