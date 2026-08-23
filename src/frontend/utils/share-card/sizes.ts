import type { ShareSize } from '@shared/share/share-model';

/**
 * The card's CSS layout size, which is also the exact PNG size produced.
 *
 * The capture comes back at the display's pixel ratio (2400x1260 on a retina
 * screen) and is normalized down to these dimensions, so the output is
 * identical on every machine and stays sharp because it was rasterized larger.
 */
export const SIZES: Record<
  ShareSize,
  { width: number; height: number; label: string; shortLabel: string }
> = {
  og: { width: 1200, height: 630, label: '1200 × 630', shortLabel: 'Landscape' },
  square: { width: 1080, height: 1080, label: '1080 × 1080', shortLabel: 'Square' },
};
