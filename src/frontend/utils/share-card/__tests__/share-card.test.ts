import { describe, expect, it } from 'vitest';
import {
  buildShareModel,
  MAX_STATS,
  TEMPLATE_STATS,
  type ShareOptions,
  type ShareSize,
  type ShareStatKey,
} from '@shared/share/share-model';
import { CONTEXT, makeEmptyStats, makeStats } from '../../../../shared/share/__tests__/fixtures';
import { renderShareCardHtml } from '../render';
import { MAX_STAT_CAPACITY, statCapacity } from '../capacity';
import { DESIGNS, resolveDesign } from '../types';
import { palette } from '../palette';
import { makeTheme } from './fixtures';

const options = (overrides: Partial<ShareOptions> = {}): ShareOptions => ({
  template: 'recap',
  statKeys: TEMPLATE_STATS.recap,
  anonymizeProjects: false,
  size: 'og',
  ...overrides,
});

const model = (overrides: Partial<ShareOptions> = {}) =>
  buildShareModel(makeStats(), options(overrides), CONTEXT);

const SIZES: ShareSize[] = ['og', 'square'];

describe('statCapacity', () => {
  it('gives the poster layout one fewer stat on the shorter card', () => {
    expect(statCapacity('poster', 'og')).toBeLessThan(statCapacity('poster', 'square'));
  });

  it('never promises more than the share model will build', () => {
    for (const design of DESIGNS) {
      for (const size of SIZES) {
        expect(statCapacity(design, size)).toBeLessThanOrEqual(MAX_STATS);
      }
    }
  });

  it('keeps the model cap in step with the widest layout', () => {
    // A design that grew past this would be silently truncated by the model.
    expect(MAX_STATS).toBe(MAX_STAT_CAPACITY);
  });

  it('maps a renamed design onto the one that replaced it', () => {
    // These shipped as 'spotlight' and 'terminal'; a returning user still has
    // the old name in localStorage.
    expect(resolveDesign('spotlight')).toBe('poster');
    expect(resolveDesign('terminal')).toBe('receipt');
  });

  it('falls back to a real design for anything unrecognised', () => {
    expect(resolveDesign('variantC')).toBe('poster');
    expect(resolveDesign(null)).toBe('poster');
    expect(resolveDesign(undefined)).toBe('poster');
  });

  it('rejects an inherited property name from a poisoned stored value', () => {
    // These are truthy on any object literal, so a bare lookup hands back a
    // function or the prototype instead of falling through to the default.
    for (const key of ['constructor', 'toString', '__proto__', 'valueOf']) {
      expect(resolveDesign(key)).toBe('poster');
    }
  });

  it('leaves a current design untouched', () => {
    for (const design of DESIGNS) expect(resolveDesign(design)).toBe(design);
  });

  it('always returns a number, even for an inherited key', () => {
    // `STAT_CAPACITY['poster']['__proto__']` is an object, which would end up
    // as NaN once it reached a slice.
    for (const key of ['constructor', '__proto__', 'toString']) {
      expect(typeof statCapacity(key as never, 'og')).toBe('number');
      expect(typeof statCapacity('poster', key as never)).toBe('number');
    }
  });

  it('falls back to the widest capacity for a design it does not know', () => {
    // A design read back from localStorage may predate a rename.
    const stale = 'variantC' as unknown as (typeof DESIGNS)[number];
    expect(statCapacity(stale, 'og')).toBe(MAX_STAT_CAPACITY);
  });
});

describe.each(DESIGNS)('%s card', design => {
  it.each(SIZES)('renders a self-contained document at %s', size => {
    const html = renderShareCardHtml(model({ size }), makeTheme(), size, design);

    expect(html.startsWith('<!doctype html')).toBe(true);
    // The capture window loads this from a data: URL and has no origin, so a
    // remote reference would silently render as nothing.
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toContain('<script');
  });

  it.each(SIZES)('lays the card out at the exact %s output size', size => {
    const html = renderShareCardHtml(model({ size }), makeTheme(), size, design);
    const expected = size === 'og' ? ['1200px', '630px'] : ['1080px', '1080px'];

    expect(html).toContain(`width: ${expected[0]}`);
    expect(html).toContain(`height: ${expected[1]}`);
  });

  it('shows every stat it was handed when the selection fits', () => {
    // The regression the capacity table exists to prevent: a stat the user
    // ticked that never reaches the card.
    const size: ShareSize = 'square';
    const keys = TEMPLATE_STATS.recap.slice(0, statCapacity(design, size));
    const html = renderShareCardHtml(model({ size, statKeys: keys }), makeTheme(), size, design);

    // Compared case-insensitively: the receipt design lowercases its labels
    // as part of the receipt styling.
    const lower = html.toLowerCase();
    for (const stat of model({ size, statKeys: keys }).stats) {
      expect(lower).toContain(stat.label.toLowerCase());
    }
  });

  it.each(SIZES)('never draws more stats than the %s layout holds', size => {
    const every: ShareStatKey[] = [
      'commits',
      'streak',
      'activeDays',
      'linesAdded',
      'linesRemoved',
      'projects',
    ];
    const html = renderShareCardHtml(model({ size, statKeys: every }), makeTheme(), size, design);

    const lower = html.toLowerCase();
    const drawn = model({ size, statKeys: every }).stats.filter(stat =>
      lower.includes(stat.label.toLowerCase())
    );
    expect(drawn.length).toBeLessThanOrEqual(statCapacity(design, size));
  });

  it('escapes a project name that contains markup', () => {
    const stats = makeStats();
    stats.detail!.perProject[0].projectPath = '/repos/<img src=x onerror=alert(1)>';
    const built = buildShareModel(stats, options(), { ...CONTEXT, allProjects: [] });
    const html = renderShareCardHtml(built, makeTheme(), 'og', design);

    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
  });

  it('inlines the brand mark rather than linking it', () => {
    const html = renderShareCardHtml(model(), makeTheme(), 'og', design);

    // The trapezoid's opening path command, from logo-mark.svg.
    expect(html).toContain('M932.418');
    expect(html).not.toContain('src="');
  });

  it('carries a custom theme colour onto the card', () => {
    const theme = makeTheme({
      isDark: true,
      colors: { 'color-primary-400': '#ff0000' },
    });
    const html = renderShareCardHtml(model(), theme, 'og', design);

    expect(html).toContain('#ff0000');
  });

  it('leaves no token unresolved', () => {
    const html = renderShareCardHtml(model(), makeTheme(), 'og', design);

    // Catches the whole family of palette typos and arithmetic on empty input.
    expect(html).not.toContain('undefined');
    expect(html).not.toContain('NaN');
  });

  it('renders identically for identical input', () => {
    const once = renderShareCardHtml(model(), makeTheme(), 'og', design);
    const twice = renderShareCardHtml(model(), makeTheme(), 'og', design);

    // A random gradient id would make the PNG non-reproducible.
    expect(once).toBe(twice);
  });

  it('falls back to a plain card when the period has no commits', () => {
    const built = buildShareModel(makeEmptyStats(), options(), CONTEXT);
    const html = renderShareCardHtml(built, makeTheme(), 'og', design);

    expect(html).toContain('Nothing to show');
  });

  it('falls back to a plain card when every stat is cleared', () => {
    // Reachable from the picker: nothing stops the user unticking all of them,
    // and both layouts lead with a hero figure they would not have.
    const built = model({ statKeys: [] });
    const html = renderShareCardHtml(built, makeTheme(), 'og', design);

    expect(html).toContain('Nothing to show');
  });

  it('survives a period with a single day of history', () => {
    const stats = makeStats();
    stats.days = stats.days.slice(0, 1);
    const built = buildShareModel(stats, options(), CONTEXT);

    expect(() => renderShareCardHtml(built, makeTheme(), 'og', design)).not.toThrow();
  });
});

describe('palette', () => {
  it('falls back to a legible value for every missing token', () => {
    const bare = palette(makeTheme({ colors: {} }));

    for (const value of Object.values(bare)) {
      expect(value).toMatch(/^#/);
    }
  });

  it('flips the background between light and dark', () => {
    expect(palette(makeTheme({ isDark: false })).bg).not.toBe(
      palette(makeTheme({ isDark: true })).bg
    );
  });
});
