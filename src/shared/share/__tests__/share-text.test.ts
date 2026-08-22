import { describe, expect, it } from 'vitest';
import { buildShareModel, TEMPLATE_STATS } from '../share-model';
import type { ShareOptions } from '../share-model';
import { renderBar, renderShareText, renderShareTextCompact, renderSparkline } from '../share-text';
import { CONTEXT, makeEmptyStats, makeStats } from './fixtures';

const options = (overrides: Partial<ShareOptions> = {}): ShareOptions => ({
  template: 'recap',
  statKeys: TEMPLATE_STATS.recap,
  anonymizeProjects: false,
  size: 'og',
  ...overrides,
});

const model = (o: Partial<ShareOptions> = {}) => buildShareModel(makeStats(), options(o), CONTEXT);

describe('renderSparkline', () => {
  it('returns nothing for an empty series', () => {
    expect(renderSparkline([])).toBe('');
  });

  it('returns nothing when nothing happened', () => {
    // A row of identical bars would imply activity that isn't there.
    expect(renderSparkline([0, 0, 0, 0])).toBe('');
  });

  it('spans the shortest active glyph to the tallest across the range', () => {
    expect(renderSparkline([1, 5])).toBe('▂█');
  });

  it('renders a flat series at full height', () => {
    expect(renderSparkline([4, 4, 4])).toBe('███');
  });

  it('keeps zero days visibly shorter than any active day', () => {
    const out = renderSparkline([0, 1, 10]);
    expect(out[0]).toBe('▁');
    expect(out[1]).not.toBe('▁');
  });

  it('emits one glyph per value', () => {
    expect(renderSparkline([3, 1, 4, 1, 5])).toHaveLength(5);
  });

  it('handles a single day', () => {
    expect(renderSparkline([7])).toBe('█');
  });
});

describe('renderBar', () => {
  it('renders an empty bar at 0%', () => {
    expect(renderBar(0)).toBe('░'.repeat(10));
  });

  it('renders a full bar at 100%', () => {
    expect(renderBar(100)).toBe('█'.repeat(10));
  });

  it('rounds to the nearest cell', () => {
    expect(renderBar(41)).toBe('████░░░░░░');
  });

  it('clamps out-of-range input', () => {
    expect(renderBar(-10)).toBe('░'.repeat(10));
    expect(renderBar(150)).toBe('█'.repeat(10));
  });

  it('always emits the requested width', () => {
    for (const pct of [0, 7, 33, 66, 99, 100]) {
      expect(renderBar(pct)).toHaveLength(10);
    }
  });
});

describe('renderShareText', () => {
  it('matches the expected layout', () => {
    expect(renderShareText(model())).toMatchInlineSnapshot(`
      "Barnacles · March 2025

      199 commits across 5 projects
      ▃▄▁▂▇▃▂▅▅█▄▃▁▁▆▇▄▂▃▅█▄▂▁▅▆▃▄▇▃▅

      🔥 12-day streak · 27 active days
      ＋18k / −7.0k lines

      barnacles      █████░░░░░ 46%
      dotfiles       ███░░░░░░░ 25%
      site           ██░░░░░░░░ 17%

      barnacles.app"
    `);
  });

  it('replaces project names when anonymizing', () => {
    const text = renderShareText(model({ anonymizeProjects: true }));
    expect(text).toContain('Barnacle A');
    expect(text).not.toContain('barnacles ');
    expect(text).not.toContain('dotfiles');
  });

  it('still ends with the attribution when anonymized', () => {
    expect(renderShareText(model({ anonymizeProjects: true }))).toContain('barnacles.app');
  });

  it('separates blocks with blank lines so markdown does not collapse them', () => {
    expect(renderShareText(model())).toContain('\n\n');
  });

  it('summarizes an empty period without a fake sparkline', () => {
    const empty = buildShareModel(makeEmptyStats(), options(), CONTEXT);
    const text = renderShareText(empty);
    expect(text).toContain('No commits in March 2025.');
    expect(text).not.toContain('▁');
  });

  it('falls back to languages when there are no projects', () => {
    const stats = makeStats();
    stats.detail!.perProject = [];
    const text = renderShareText(buildShareModel(stats, options(), CONTEXT));
    expect(text).toContain('TypeScript');
  });
});

describe('renderShareTextCompact', () => {
  it('fits inside a 280-character limit', () => {
    expect(renderShareTextCompact(model()).length).toBeLessThan(280);
  });

  it('drops the ranked block but keeps the shape and the streak', () => {
    const text = renderShareTextCompact(model());
    expect(text).not.toContain('barnacles      ');
    expect(text).toContain('🔥');
    expect(text).toContain('▁');
    expect(text).toContain('barnacles.app');
  });

  it('summarizes an empty period the same way as the full variant', () => {
    const empty = buildShareModel(makeEmptyStats(), options(), CONTEXT);
    expect(renderShareTextCompact(empty)).toBe(renderShareText(empty));
  });
});
