import type { CardTheme } from './types';

/**
 * Snapshots the running app's theme so the card can carry it.
 *
 * Themes are user-customizable, so the values must be read at runtime rather
 * than hardcoded — a custom theme then carries onto the card for free.
 */

/**
 * The theme tokens the card uses.
 *
 * Deliberately a fixed short list rather than the whole ramp: the document is
 * embedded in a URL, so every unused variable is wasted bytes.
 */
const TOKENS = [
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

export function snapshotTheme(): CardTheme {
  const root = document.documentElement;
  const styles = getComputedStyle(root);

  const colors: Record<string, string> = {};
  for (const token of TOKENS) {
    const value = styles.getPropertyValue(`--${token}`).trim();
    if (value) colors[token] = value;
  }

  const fontFamily =
    styles.getPropertyValue('--font-ui').trim() || "'Istok Web', system-ui, sans-serif";

  return {
    colors,
    fontFamily,
    isDark: root.classList.contains('dark'),
  };
}
