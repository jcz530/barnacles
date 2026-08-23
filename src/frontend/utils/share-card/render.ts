import type { ShareModel, ShareSize } from '@shared/share/share-model';
import { renderPoster } from './designs/poster';
import { renderReceipt } from './designs/receipt';
import { escapeHtml, renderLogo } from './primitives';
import { palette } from './palette';
import { SIZES } from './sizes';
import type { CardTheme, ShareDesign } from './types';

/**
 * Builds the share card as a standalone HTML document.
 *
 * The same string is used for the dialog preview (in an iframe) and for the
 * PNG capture, so what the user sees is exactly what gets rasterized — there is
 * no second implementation of the card to drift out of sync.
 *
 * The document must be fully self-contained: the capture window loads it from a
 * `data:` URL and has no origin, so every color, font, and asset is inlined.
 *
 * Kept apart from `index.ts` so it can be imported without pulling in
 * `snapshotTheme`, which needs a live DOM.
 */

/**
 * The fallback card for a period with nothing to show.
 *
 * Both designs lead with a hero figure, so neither can render without one. The
 * Share button is disabled for an empty period, but a user can still clear
 * every stat in the picker, which lands here rather than throwing.
 */
function renderEmptyCard(model: ShareModel, theme: CardTheme, size: ShareSize): string {
  const { width, height } = SIZES[size];
  const p = palette(theme);
  const pad = Math.round(width * 0.055);

  return `<!doctype html>
<meta charset="utf-8">
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    width: ${width}px; height: ${height}px;
    background: ${p.bg}; color: ${p.text}; font-family: ${theme.fontFamily};
    padding: ${pad}px; display: flex; flex-direction: column;
    -webkit-font-smoothing: antialiased;
  }
  .brand { display: flex; align-items: center; gap: ${Math.round(width * 0.011)}px;
    font-weight: 700; font-size: ${Math.round(width * 0.021)}px; }
  .mid { margin: auto 0; }
  .period { font-size: ${Math.round(width * 0.038)}px; font-weight: 700; letter-spacing: -0.02em; }
  .note { font-size: ${Math.round(width * 0.023)}px; color: ${p.muted}; margin-top: ${Math.round(width * 0.01)}px; }
  .foot { display: flex; justify-content: space-between;
    font-size: ${Math.round(width * 0.0155)}px; color: ${p.muted}; }
</style>
<div class="brand">${renderLogo(p, Math.round(width * 0.0152))}Barnacles Report</div>
<div class="mid">
  <div class="period">${escapeHtml(model.periodLabel)}</div>
  <div class="note">Nothing to show for this period</div>
</div>
<div class="foot"><span>${escapeHtml(model.scopeLabel)}</span><span>${escapeHtml(model.attribution)}</span></div>
`;
}

export function renderShareCardHtml(
  model: ShareModel,
  theme: CardTheme,
  size: ShareSize,
  design: ShareDesign
): string {
  // Guarded once here rather than in each design: every layout leads with
  // `stats[0]`, so none of them can render a model without one.
  if (model.isEmpty || model.stats.length === 0 || model.sparkline.length === 0) {
    return renderEmptyCard(model, theme, size);
  }

  switch (design) {
    case 'receipt':
      return renderReceipt(model, theme, size);
    case 'poster':
    default:
      // A design read back from localStorage may no longer exist; fall back
      // rather than rendering a blank card.
      return renderPoster(model, theme, size);
  }
}
