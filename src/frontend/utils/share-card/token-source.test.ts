import { describe, expect, it } from 'vitest';
import { sourceVar, TOKENS } from './token-source';
import { palette } from './palette';
import type { CardTheme } from './types';

/**
 * Dark mode is palette inversion, so reading a themed --color-* variable off the
 * element gives a value under the *opposite* shade's name. The card has to undo
 * that, or `palette()` — which is written against the un-inverted ramp — paints
 * a dark card white. That was the bug: dark app, light share image.
 *
 * Tested here rather than through `snapshotTheme` because the test project
 * compiles without the DOM lib (vitest runs it in node), so importing anything
 * that touches `document` drags it into a compilation that cannot type it.
 * `snapshotTheme` is a thin wrapper: read the element through `sourceVar`, which
 * is what these tests pin.
 */

/**
 * Light-mode values for the full ramp, which is what the element actually
 * carries: useTheme writes all eleven shades of all six themed palettes, so a
 * token's complement is always present to be read back. TOKENS is only the
 * short list the *card* uses, and several of its entries (primary-300,
 * slate-200, slate-400) have complements outside it — so a fixture limited to
 * TOKENS would leave a dark-mode read resolving to nothing.
 */
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const PALETTES = ['slate', 'primary', 'secondary', 'tertiary', 'success', 'danger'];

const LIGHT: Record<string, string> = Object.fromEntries(
  PALETTES.flatMap(name =>
    // A distinct, checkable value per variable; the exact colour is irrelevant,
    // only that each one is uniquely identifiable after an inversion.
    SHADES.map(shade => [`color-${name}-${shade}`, `#${name.slice(0, 3)}${shade}`])
  )
);

// The few real hexes the assertions below name, so they read as colours.
Object.assign(LIGHT, {
  'color-slate-50': '#f8fafc',
  'color-slate-900': '#0f172a',
  'color-slate-950': '#020617',
  'color-primary-400': '#22cdf0',
  'color-primary-500': '#00c2e5',
});

const DARKEST = LIGHT['color-slate-950'];
const LIGHTEST = LIGHT['color-slate-50'];

/**
 * What the element holds in each app mode.
 *
 * Mirrors useColorInversion: in dark mode each themed shade s carries the light
 * value of 1000-s. Derived from LIGHT rather than hand-written, so the fixture
 * cannot drift from the rule it stands in for.
 */
function elementVars(appIsDark: boolean): Record<string, string> {
  if (!appIsDark) return { ...LIGHT };

  const out: Record<string, string> = {};
  for (const [token, value] of Object.entries(LIGHT)) {
    const m = token.match(/^color-([a-z]+)-(\d+)$/);
    if (!m) continue;
    const twin = `color-${m[1]}-${1000 - Number(m[2])}`;
    if (LIGHT[twin] !== undefined) out[twin] = value;
  }
  return out;
}

/** The colours `snapshotTheme` would collect, without touching a document. */
function collect(appIsDark: boolean): Record<string, string> {
  const vars = elementVars(appIsDark);
  const colors: Record<string, string> = {};
  for (const token of TOKENS) {
    const value = vars[sourceVar(token, appIsDark)];
    if (value) colors[token] = value;
  }
  return colors;
}

const theme = (appIsDark: boolean, isDark: boolean): CardTheme => ({
  colors: collect(appIsDark),
  fontFamily: "'Istok Web', sans-serif",
  isDark,
});

describe('sourceVar', () => {
  it('reads a token straight through while the app is light', () => {
    expect(sourceVar('color-slate-950', false)).toBe('color-slate-950');
  });

  it('reads a themed token through its complement while the app is dark', () => {
    expect(sourceVar('color-slate-950', true)).toBe('color-slate-50');
    expect(sourceVar('color-primary-400', true)).toBe('color-primary-600');
  });

  it('leaves a token of no themed palette alone', () => {
    // Stock Tailwind scales are never inverted, so their variables mean what
    // they say even in dark mode.
    expect(sourceVar('color-amber-600', true)).toBe('color-amber-600');
  });

  it('recovers the un-inverted ramp from a dark app', () => {
    // The core claim: whatever the app is doing, a token resolves to its own
    // light-mode value, which is the ramp `palette()` expects.
    for (const token of TOKENS) {
      expect(collect(true)[token], token).toBe(LIGHT[token]);
    }
  });
});

describe('the card palette, through the inversion', () => {
  it('renders a dark card dark while the app is dark', () => {
    // The regression. Before the fix this resolved to #f8fafc — the white card
    // in the bug report.
    const p = palette(theme(true, true));

    expect(p.bg).toBe(DARKEST);
    expect(p.text).toBe(LIGHTEST);
  });

  it('renders a light card light while the app is light', () => {
    const p = palette(theme(false, false));

    expect(p.bg).toBe(LIGHTEST);
    expect(p.text).toBe(LIGHT['color-slate-900']);
  });

  it('renders a light card while the app is dark', () => {
    const p = palette(theme(true, false));

    expect(p.bg).toBe(LIGHTEST);
    expect(p.text).toBe(LIGHT['color-slate-900']);
  });

  it('renders a dark card while the app is light', () => {
    const p = palette(theme(false, true));

    expect(p.bg).toBe(DARKEST);
    expect(p.text).toBe(LIGHTEST);
  });

  it('carries a custom accent in either mode', () => {
    // Themes are user-customizable, and the accent is not a slate: check the
    // inversion does not strand it.
    expect(palette(theme(true, true)).accent).toBe(LIGHT['color-primary-400']);
    expect(palette(theme(false, false)).accent).toBe(LIGHT['color-primary-500']);
  });
});
