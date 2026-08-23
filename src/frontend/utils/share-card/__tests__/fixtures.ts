import type { CardTheme } from '../types';

/** A resolved palette standing in for the snapshot the live app produces. */
const COLORS: Record<string, string> = {
  'color-primary-300': '#67e3fa',
  'color-primary-400': '#22cdf0',
  'color-primary-500': '#00c2e5',
  'color-primary-600': '#0499b8',
  'color-secondary-400': '#dc8cbc',
  'color-success-400': '#34d399',
  'color-success-500': '#10b981',
  'color-danger-400': '#f87171',
  'color-danger-500': '#ef4444',
  'color-slate-50': '#f8fafc',
  'color-slate-200': '#e2e8f0',
  'color-slate-400': '#94a3b8',
  'color-slate-500': '#64748b',
  'color-slate-700': '#334155',
  'color-slate-800': '#1e293b',
  'color-slate-900': '#0f172a',
  'color-slate-950': '#020617',
};

export function makeTheme(overrides: Partial<CardTheme> = {}): CardTheme {
  return {
    colors: { ...COLORS, ...(overrides.colors ?? {}) },
    fontFamily: "'Istok Web', system-ui, sans-serif",
    isDark: false,
    ...overrides,
  };
}
