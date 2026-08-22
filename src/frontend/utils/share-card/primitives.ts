import dayjs from 'dayjs';
import type { ShareModel, ShareStatKey } from '@shared/share/share-model';
import type { CardPalette } from './palette';

/**
 * The pieces both card designs are built from.
 *
 * Every design is a standalone HTML document with no component runtime, so
 * anything shared has to be a string builder rather than a component.
 */

export const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Inline copies of the lucide icons the Stats page pairs with each figure.
 *
 * Paths are taken verbatim from `lucide-vue-next` and share its 24x24 viewBox
 * and stroke conventions, so they match the app's tiles.
 */
const ICONS: Partial<Record<ShareStatKey, string>> = {
  // flame
  streak:
    '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  // git-commit-horizontal
  commits:
    '<circle cx="12" cy="12" r="3"/><line x1="3" x2="9" y1="12" y2="12"/><line x1="15" x2="21" y1="12" y2="12"/>',
  // file-text
  filesChanged:
    '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
  // folder-git-2
  projects:
    '<path d="M9 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v5"/><circle cx="13" cy="12" r="2"/><path d="M18 19c-2.8 0-5-2.2-5-5v8"/><circle cx="20" cy="19" r="2"/>',
  // plus
  linesAdded: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  // minus
  linesRemoved: '<path d="M5 12h14"/>',
  // scale
  netLines:
    '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
  // scale, matching net lines: churn is the same measure unsigned
  churn:
    '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
  // calendar-days
  activeDays:
    '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="M8 14h.01"/><path d="M12 14h.01"/><path d="M16 14h.01"/><path d="M8 18h.01"/><path d="M12 18h.01"/><path d="M16 18h.01"/>',
  // zap
  avgPerActiveDay:
    '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  // trophy
  busiestDay:
    '<path d="M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978"/><path d="M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978"/><path d="M18 9h1.5a1 1 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/><path d="M6 9H4.5a1 1 0 0 1 0-5H6"/>',
};

export function renderIcon(key: ShareStatKey, color: string, size: number, opacity = 1): string {
  const paths = ICONS[key];
  if (!paths) return '';

  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}" style="flex:none">${paths}</svg>`;
}

/** The colour a stat's icon takes, mirroring the Stats page tiles. */
export function iconColor(key: ShareStatKey, p: CardPalette): string {
  switch (key) {
    case 'linesAdded':
      return p.success;
    case 'linesRemoved':
      return p.danger;
    default:
      return p.accent;
  }
}

export function toneColor(tone: string | undefined, p: CardPalette): string {
  if (tone === 'success') return p.success;
  if (tone === 'danger') return p.danger;
  return p.text;
}

/** Format a stat for display; busiest day carries an ISO date as its value. */
export function statDisplay(key: string, value: string): string {
  return key === 'busiestDay' ? dayjs(value).format('MMM D') : value;
}

/**
 * The stat that becomes the hero, and the rest in order.
 *
 * The first selected stat leads, which means the dialog's template presets
 * already choose a sensible hero without needing a separate control.
 */
export function splitHero(model: ShareModel) {
  return { hero: model.stats[0], rest: model.stats.slice(1) };
}

/** A headline phrase for the card, derived from the period. */
export function headline(model: ShareModel): string {
  if (model.granularity === 'week') return 'This week in code';
  return model.granularity === 'month' ? 'This month in code' : 'This year in code';
}

/**
 * The brand mark, inlined.
 *
 * Kept in sync with `src/frontend/assets/logo-mark.svg` — a literal rather than
 * a `?raw` import so this stays a pure function with no bundler dependency,
 * which is what makes it testable outside a browser.
 */
const LOGO_PATH =
  'M932.418 0.657104C978.068 -0.0550224 1020.2 25.0932 1041.24 65.6112L1329.91 621.53C1371.8 702.202 1312.69 798.44 1221.8 797.556L119.584 786.826C31.6365 785.97 -25.7937 694.232 11.8577 614.747L265.973 78.287C285.617 36.8166 327.111 10.1026 372.993 9.3866L932.418 0.657104ZM437.229 244C433.734 244 430.555 246.024 429.075 249.19L291.361 543.955C288.604 549.855 292.833 556.64 299.344 556.764L1033.25 570.71C1040.1 570.84 1044.58 563.573 1041.39 557.513L878.532 248.801C876.975 245.848 873.911 244 870.573 244H437.229Z';

const LOGO_RATIO = 1344 / 798;

/**
 * Draw the mark at a given height.
 *
 * Always the theme-tinted gradient — `LogoMark.vue`'s custom-theme branch —
 * rather than the fixed brand colours. On the stock theme the two are close
 * enough to be indistinguishable, and on a customized one the card then
 * matches the app the user is actually looking at.
 */
export function renderLogo(p: CardPalette, height: number): string {
  const width = Math.round(height * LOGO_RATIO);
  // Deterministic, so the same input always renders byte-identical output.
  const id = `logo-${height}`;

  return `<svg width="${width}" height="${height}" viewBox="0 0 1344 798" fill="none" style="flex:none"><path d="${LOGO_PATH}" fill="url(#${id})"/><defs><linearGradient id="${id}" x1="1115" y1="-39.5" x2="187.5" y2="631.5" gradientUnits="userSpaceOnUse"><stop stop-color="${p.accent}"/><stop offset="1" stop-color="${p.secondary}"/></linearGradient></defs></svg>`;
}
