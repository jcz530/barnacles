import type { Component } from 'vue';
import { Image as ImageIcon, ReceiptText } from 'lucide-vue-next';

/**
 * The card's presentational vocabulary.
 *
 * A design is a layout choice and nothing more: it never reaches
 * `buildShareModel`, so the same `ShareModel` renders under either one. That is
 * what keeps the text summary and the PNG unable to disagree.
 */

export interface CardTheme {
  /** Resolved `--color-*` values, snapshotted from the live app. */
  colors: Record<string, string>;
  fontFamily: string;
  isDark: boolean;
}

export type ShareDesign = 'poster' | 'receipt';

/** The user-facing name and icon for each design, used by the share dialog. */
export const DESIGN_META: Record<ShareDesign, { label: string; icon: Component }> = {
  poster: { label: 'Poster', icon: ImageIcon },
  receipt: { label: 'Receipt', icon: ReceiptText },
};

/** Every design, in the order the dialog offers them. */
export const DESIGNS: ShareDesign[] = ['poster', 'receipt'];

/** What these designs used to be called, for values already in localStorage. */
const RENAMED: Record<string, ShareDesign> = {
  spotlight: 'poster',
  terminal: 'receipt',
};

/**
 * Resolve a stored preference to a design that still exists.
 *
 * Normalized once on read rather than guarded at every use, so capacity and
 * rendering cannot disagree about which design a stale value means.
 */
export function resolveDesign(stored: string | null | undefined): ShareDesign {
  if (DESIGNS.includes(stored as ShareDesign)) return stored as ShareDesign;
  // `hasOwn` rather than a bare lookup: `constructor` and friends are truthy on
  // any object literal, so they would pass straight through the ?? fallback and
  // return something that is not a design at all.
  if (stored != null && Object.hasOwn(RENAMED, stored)) return RENAMED[stored];
  return 'poster';
}
