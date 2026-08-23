import type { CardTheme } from './types';

/**
 * Resolves a theme snapshot into the handful of roles the cards draw with.
 *
 * Pure and DOM-free on purpose: the renderers are testable in node, and only
 * `snapshotTheme` needs a live document.
 */

/** Pick a readable foreground/background pair for the card's mode. */
export function palette(theme: CardTheme) {
  const c = (token: string, fallback: string) => theme.colors[token] || fallback;

  return theme.isDark
    ? {
        bg: c('color-slate-950', '#020617'),
        text: c('color-slate-50', '#f8fafc'),
        muted: c('color-slate-400', '#94a3b8'),
        faint: c('color-slate-700', '#334155'),
        line: c('color-slate-800', '#1e293b'),
        accent: c('color-primary-400', '#22cdf0'),
        accentDeep: c('color-primary-600', '#0499b8'),
        secondary: c('color-secondary-400', '#dc8cbc'),
        success: c('color-success-400', '#34d399'),
        danger: c('color-danger-400', '#f87171'),
      }
    : {
        bg: c('color-slate-50', '#f8fafc'),
        text: c('color-slate-900', '#0f172a'),
        muted: c('color-slate-500', '#64748b'),
        faint: c('color-slate-200', '#e2e8f0'),
        line: c('color-slate-200', '#e2e8f0'),
        accent: c('color-primary-500', '#00c2e5'),
        accentDeep: c('color-primary-600', '#0499b8'),
        secondary: c('color-secondary-400', '#dc8cbc'),
        success: c('color-success-500', '#10b981'),
        danger: c('color-danger-500', '#ef4444'),
      };
}

export type CardPalette = ReturnType<typeof palette>;
