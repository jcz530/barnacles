import { describe, expect, it } from 'vitest';
import { buildShareModel, formatCompact, TEMPLATE_STATS, MAX_STATS } from '../share-model';
import type { ShareOptions } from '../share-model';
import { CONTEXT, makeEmptyStats, makeStats } from './fixtures';

const options = (overrides: Partial<ShareOptions> = {}): ShareOptions => ({
  template: 'recap',
  statKeys: TEMPLATE_STATS.recap,
  anonymizeProjects: false,
  size: 'og',
  ...overrides,
});

describe('formatCompact', () => {
  it('leaves values under a thousand alone', () => {
    expect(formatCompact(0)).toBe('0');
    expect(formatCompact(999)).toBe('999');
  });

  it('abbreviates thousands, dropping the decimal once it stops informing', () => {
    expect(formatCompact(1000)).toBe('1.0k');
    expect(formatCompact(9900)).toBe('9.9k');
    expect(formatCompact(24132)).toBe('24k');
  });

  it('abbreviates millions', () => {
    expect(formatCompact(1_500_000)).toBe('1.5M');
  });

  it('keeps the sign on negatives', () => {
    expect(formatCompact(-24132)).toBe('-24k');
  });
});

describe('buildShareModel', () => {
  it('resolves project paths to their display names', () => {
    const model = buildShareModel(makeStats(), options(), CONTEXT);
    expect(model.projects.map(p => p.name)).toEqual(['barnacles', 'dotfiles', 'site']);
  });

  it('falls back to the last path segment for untracked projects', () => {
    const model = buildShareModel(makeStats(), options(), { ...CONTEXT, allProjects: [] });
    expect(model.projects[0].name).toBe('barnacles');
  });

  it('anonymizes project names by rank, stably', () => {
    const model = buildShareModel(makeStats(), options({ anonymizeProjects: true }), CONTEXT);
    expect(model.projects.map(p => p.name)).toEqual(['Barnacle A', 'Barnacle B', 'Barnacle C']);

    // Same input must give the same labels every time.
    const again = buildShareModel(makeStats(), options({ anonymizeProjects: true }), CONTEXT);
    expect(again.projects.map(p => p.name)).toEqual(model.projects.map(p => p.name));
  });

  it('never leaks a real project name when anonymizing', () => {
    const model = buildShareModel(makeStats(), options({ anonymizeProjects: true }), CONTEXT);
    // Both of these carry the product name rather than a project's, and are
    // asserted on their own terms instead — see the scope tests above.
    const { attribution, scopeLabel, ...rest } = model;
    expect(attribution).toBe('barnacles.app');
    expect(scopeLabel).toBe('All barnacles');
    const serialized = JSON.stringify(rest);
    for (const name of ['barnacles', 'dotfiles', 'site', 'notes']) {
      expect(serialized).not.toContain(name);
    }
  });

  it('leaves languages untouched when anonymizing', () => {
    const model = buildShareModel(makeStats(), options({ anonymizeProjects: true }), CONTEXT);
    expect(model.languages.map(l => l.label)).toEqual(['TypeScript', 'Vue', 'CSS']);
  });

  it('caps the stat list at what the layout holds', () => {
    const model = buildShareModel(
      makeStats(),
      options({
        statKeys: [
          'commits',
          'streak',
          'activeDays',
          'linesAdded',
          'linesRemoved',
          'projects',
          'churn',
          'netLines',
        ],
      }),
      CONTEXT
    );
    expect(model.stats).toHaveLength(MAX_STATS);
  });

  it('abbreviates an average that would otherwise overflow the card', () => {
    const stats = makeStats();
    stats.totals.commits = 9_900_000;
    stats.totals.activeDays = 1;
    const model = buildShareModel(stats, options({ statKeys: ['avgPerActiveDay'] }), CONTEXT);
    expect(model.stats[0].value).toBe('9.9M');
  });

  it('keeps the decimal on an average at everyday scale', () => {
    // The decimal is the whole point at 7.4 commits a day.
    const stats = makeStats();
    stats.totals.commits = 74;
    stats.totals.activeDays = 10;
    const model = buildShareModel(stats, options({ statKeys: ['avgPerActiveDay'] }), CONTEXT);
    expect(model.stats[0].value).toBe('7.4');
  });

  it('uses the longest streak when the period has no running one', () => {
    const model = buildShareModel(makeStats(), options({ statKeys: ['streak'] }), CONTEXT);
    expect(model.stats[0].rawValue).toBe(12);
  });

  it('prefers a running streak when there is one', () => {
    const stats = makeStats();
    stats.detail!.streaks.current = 5;
    const model = buildShareModel(stats, options({ statKeys: ['streak'] }), CONTEXT);
    expect(model.stats[0].rawValue).toBe(5);
  });

  it('drops the busiest-day stat when the period has no activity', () => {
    const model = buildShareModel(makeEmptyStats(), options({ statKeys: ['busiestDay'] }), CONTEXT);
    expect(model.stats).toHaveLength(0);
  });

  it('flags an empty period', () => {
    expect(buildShareModel(makeEmptyStats(), options(), CONTEXT).isEmpty).toBe(true);
    expect(buildShareModel(makeStats(), options(), CONTEXT).isEmpty).toBe(false);
  });

  it('describes the project scope', () => {
    expect(buildShareModel(makeStats(), options(), CONTEXT).scopeLabel).toBe('All barnacles');

    expect(
      buildShareModel(makeStats(), options(), {
        ...CONTEXT,
        selectedProjects: ['/Users/dev/code/barnacles'],
      }).scopeLabel
    ).toBe('barnacles');

    expect(
      buildShareModel(makeStats(), options(), {
        ...CONTEXT,
        selectedProjects: ['/Users/dev/code/barnacles', '/Users/dev/code/site'],
      }).scopeLabel
    ).toBe('2 barnacles');
  });

  it('does not name the selected project in the scope when anonymizing', () => {
    // The scope label captions the card, so leaving the real name there would
    // undo the anonymizing applied to the ranked list beside it.
    expect(
      buildShareModel(makeStats(), options({ anonymizeProjects: true }), {
        ...CONTEXT,
        selectedProjects: ['/Users/dev/code/barnacles'],
      }).scopeLabel
    ).toBe('1 barnacle');
  });

  it('gives the taller square card more list rows', () => {
    const og = buildShareModel(makeStats(), options({ size: 'og' }), CONTEXT);
    const square = buildShareModel(makeStats(), options({ size: 'square' }), CONTEXT);
    expect(square.projects.length).toBeGreaterThan(og.projects.length);
  });

  it('emits one sparkline value per day', () => {
    const model = buildShareModel(makeStats(), options(), CONTEXT);
    expect(model.sparkline).toHaveLength(31);
  });

  it('pairs every sparkline value with its date', () => {
    // The card labels its bars from these, so a mismatch would mislabel days.
    const model = buildShareModel(makeStats(), options(), CONTEXT);
    expect(model.sparklineDates).toHaveLength(model.sparkline.length);
    expect(model.sparklineDates[0]).toBe('2025-03-01');
    expect(model.sparklineDates.at(-1)).toBe('2025-03-31');
  });

  it('keeps values and dates aligned when a year is bucketed', () => {
    const model = buildShareModel(makeStats(), options(), { ...CONTEXT, granularity: 'year' });
    expect(model.sparklineDates).toHaveLength(model.sparkline.length);
  });

  it('buckets a year into weeks rather than days', () => {
    const stats = makeStats();
    const model = buildShareModel(stats, options(), { ...CONTEXT, granularity: 'year' });
    // A single month's worth of days spans ~5 ISO weeks.
    expect(model.sparkline.length).toBeLessThan(stats.days.length);
    expect(model.sparkline.length).toBeGreaterThan(0);
  });

  it('tones added and removed lines for the card', () => {
    const model = buildShareModel(
      makeStats(),
      options({ statKeys: ['linesAdded', 'linesRemoved'] }),
      CONTEXT
    );
    expect(model.stats[0].tone).toBe('success');
    expect(model.stats[1].tone).toBe('danger');
  });
});
