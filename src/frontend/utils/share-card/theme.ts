import { isDarkMode } from '@/composables/useColorInversion';
import { sourceVar, TOKENS } from './token-source';
import type { CardTheme } from './types';

/**
 * Snapshots the running app's theme so the card can carry it.
 *
 * Themes are user-customizable, so the values must be read at runtime rather
 * than hardcoded — a custom theme then carries onto the card for free.
 *
 * Two things make reading these variables subtler than it looks, and both are
 * why the card rendered light while the app was dark:
 *
 * - Dark mode is palette inversion, not a second set of variables. In dark mode
 *   useColorInversion rewrites every themed --color-<name>-<shade> to its
 *   1000-shade counterpart, so --color-slate-950 holds what --color-slate-50
 *   held in light mode. `palette()` then asks for slate-950 as the card's
 *   background and gets a light colour. Reading the *inverted* token name
 *   undoes that, giving the true value for the mode being rendered — and it is
 *   what lets the card render a light card while the app is dark, which a bare
 *   read of the element cannot do.
 * - Dark is resolved from storage, never from the `dark` class. The class is
 *   written by useColorMode in a `flush: 'post'` watcher, so a `flush: 'pre'`
 *   reader sees the PREVIOUS mode and is one step behind on every toggle.
 */

/**
 * Snapshot the theme for a card rendered in `mode`.
 *
 * `mode` defaults to the app's own, which is the behaviour the dialog wants
 * until the user overrides it. An explicit 'light' or 'dark' renders that mode
 * regardless of what the app is showing — the card carries the app's *colours*,
 * not its light/dark state.
 */
export function snapshotTheme(mode?: 'light' | 'dark'): CardTheme {
  const isDark = mode ? mode === 'dark' : isDarkMode();
  const appIsDark = isDarkMode();
  const styles = getComputedStyle(document.documentElement);

  /*
   * Undo the app's inversion, always.
   *
   * `palette()` is written against the *un-inverted* ramp: its dark branch asks
   * for slate-950 as the background and falls back to #020617, a near-black. So
   * it expects --color-slate-950 to mean "the darkest slate", full stop.
   *
   * useColorInversion breaks that assumption in dark mode. It rewrites each
   * themed shade s to the light value of 1000-s, so on a dark app the element
   * holds:
   *
   *   --color-slate-950 = #f8fafc   (white)
   *   --color-slate-50  = #020617   (near-black)
   *
   * `palette()` then reads slate-950 for the background and paints the card
   * white — which is exactly the bug: dark app, light card.
   *
   * The fix is to read through the inversion whenever the app is inverted, so
   * `palette()` always receives the ramp it was written for. Which mode the
   * card renders is then purely `isDark` selecting a branch, independent of
   * what the app is doing — which is what makes the override possible at all.
   */
  const flip = appIsDark;

  const colors: Record<string, string> = {};
  for (const token of TOKENS) {
    const from = sourceVar(token, flip);
    const value = styles.getPropertyValue(`--${from}`).trim();
    if (value) colors[token] = value;
  }

  const fontFamily =
    styles.getPropertyValue('--font-ui').trim() || "'Istok Web', system-ui, sans-serif";

  return {
    colors,
    fontFamily,
    isDark,
  };
}
