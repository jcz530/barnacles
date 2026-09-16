import { getInvertedShade, INVERTED_PALETTES } from '@/composables/color-scales';

/**
 * Which CSS variable actually holds a card token's value.
 *
 * Split out from `theme.ts` and kept free of `document`: this is the half that
 * can be tested, and the test project compiles with `lib: ["ESNext"]` — no DOM
 * — because vitest runs it in node. `snapshotTheme` keeps the element read.
 *
 * The problem this solves: dark mode is palette inversion, not a second set of
 * variables. `useColorInversion` rewrites every themed --color-<name>-<shade>
 * to the light value of its 1000-complement, so on a dark app the element holds
 *
 *   --color-slate-950 = #f8fafc   (white)
 *   --color-slate-50  = #020617   (near-black)
 *
 * while `palette()` is written against the *un-inverted* ramp — its dark branch
 * asks for slate-950 as the background and falls back to #020617. Reading the
 * element directly therefore paints a dark card white, which is the bug.
 */

/**
 * The theme tokens the card uses.
 *
 * Deliberately a fixed short list rather than the whole ramp: the document is
 * embedded in a URL, so every unused variable is wasted bytes.
 */
export const TOKENS = [
  'color-primary-300',
  'color-primary-400',
  'color-primary-500',
  'color-primary-600',
  // Only used as the second stop of the theme-tinted logo gradient.
  'color-secondary-400',
  'color-success-400',
  'color-success-500',
  'color-danger-400',
  'color-danger-500',
  'color-slate-50',
  'color-slate-200',
  'color-slate-400',
  'color-slate-500',
  'color-slate-700',
  'color-slate-800',
  'color-slate-900',
  'color-slate-950',
];

/** `color-slate-950` -> `slate`, or null for a token that never inverts. */
function themedPalette(token: string): string | null {
  const name = token.replace(/^color-/, '').replace(/-\d+$/, '');
  return INVERTED_PALETTES.includes(name) ? name : null;
}

/**
 * The variable holding `token`'s un-inverted value, given the app's mode.
 *
 * `appIsDark` is the *app's* state, not the card's: the inversion sitting on the
 * element is the app's, so undoing it depends only on that. Which mode the card
 * then renders is `palette()`'s choice of branch, which is what lets the card
 * render light while the app is dark.
 *
 * Derived from the token string rather than a hardcoded list so a token added to
 * TOKENS cannot silently skip the inversion.
 */
export function sourceVar(token: string, appIsDark: boolean): string {
  if (!appIsDark) return token;

  const name = themedPalette(token);
  if (!name) return token;

  const shade = Number(token.slice(token.lastIndexOf('-') + 1));
  if (!Number.isFinite(shade)) return token;

  return `color-${name}-${getInvertedShade(shade)}`;
}
