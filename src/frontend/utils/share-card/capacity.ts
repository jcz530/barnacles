import type { ShareSize } from '@shared/share/share-model';
import type { ShareDesign } from './types';

/**
 * How many stats each design fits, at each size, hero included.
 *
 * Measured from rendered layouts rather than guessed — going over overflows the
 * card. Each design derives its own slice from this table instead of repeating
 * the number, so the matrix stays load-bearing rather than documentary.
 */
const STAT_CAPACITY: Record<ShareDesign, Record<ShareSize, number>> = {
  // One hero plus a single row of chips: four on the short card, five on the tall one.
  poster: { og: 5, square: 6 },
  // One hero plus five receipt lines, at either size.
  receipt: { og: 6, square: 6 },
};

/** The widest any design/size pair holds. `MAX_STATS` must not fall below it. */
export const MAX_STAT_CAPACITY = 6;

export function statCapacity(design: ShareDesign, size: ShareSize): number {
  // A design or size read back from localStorage may no longer exist; fall back
  // rather than throwing, which would blank the preview on upgrade. Checked
  // with `hasOwn` because inherited keys like `constructor` are truthy on any
  // object literal, so a bare lookup would return something that is not a
  // number and end up as NaN inside a slice.
  const bySize = Object.hasOwn(STAT_CAPACITY, design) ? STAT_CAPACITY[design] : undefined;
  const value = bySize && Object.hasOwn(bySize, size) ? bySize[size] : undefined;
  return typeof value === 'number' ? value : MAX_STAT_CAPACITY;
}
