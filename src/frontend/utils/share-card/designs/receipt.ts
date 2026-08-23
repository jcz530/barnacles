import dayjs from 'dayjs';
import type { ShareModel, ShareSize } from '@shared/share/share-model';
import { statCapacity } from '../capacity';
import {
  escapeHtml,
  renderIcon,
  renderLogo,
  splitHero,
  statDisplay,
  toneColor,
} from '../primitives';
import { palette, type CardPalette } from '../palette';
import { SIZES } from '../sizes';
import type { CardTheme } from '../types';

/**
 * "Receipt" — the recap as an itemized monospace stub.
 *
 * The format carries the personality here, so the values do not have to fight
 * for attention: dotted leaders, an accent rail, and a bar row that drops its
 * tracks and calls out the peak.
 */

/** Windows and Linux need their own entries; the capture uses system fonts. */
const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, 'DejaVu Sans Mono', monospace";

function renderBars(values: number[], p: CardPalette, width: number, height: number): string {
  if (values.length === 0) return '';

  const max = Math.max(...values, 1);
  // Pitch is capped as well as proportional: a week spread across the full
  // width gives each bar a huge slot, and at that size the columns read as
  // blocks rather than a chart. Capping keeps them slim at any period length,
  // and the row is centred once it no longer fills the width.
  const pitch = Math.min(width / values.length, 64);
  const barWidth = Math.min(Math.max(2, pitch * 0.62), 26);
  const gap = pitch - barWidth;
  const originX = (width - (pitch * (values.length - 1) + barWidth)) / 2;

  const bars = values
    .map((value, index) => {
      const barHeight = Math.max(3, (value / max) * height);
      const x = originX + index * (barWidth + gap);
      // The peak is the story, so it alone is at full strength.
      const opacity = value === max ? 1 : 0.32;
      return `<rect x="${x.toFixed(1)}" y="${(height - barHeight).toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" rx="${Math.min(barWidth / 2, 4)}" fill="${p.accent}" opacity="${opacity}"/>`;
    })
    .join('');

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">${bars}</svg>`;
}

export function renderReceipt(model: ShareModel, theme: CardTheme, size: ShareSize): string {
  const { width, height } = SIZES[size];
  const p = palette(theme);
  const square = size === 'square';
  const pad = Math.round(width * 0.05);

  const { hero, rest } = splitHero(model);
  const lines = rest.slice(0, Math.max(0, statCapacity('receipt', size) - 1));

  // The short card puts the hero beside the receipt; the tall one stacks them.
  const chartWidth = square ? width - pad * 2 : Math.round((width - pad * 2) * 0.46);
  const chartHeight = Math.round(height * (square ? 0.16 : 0.17));
  const chart = renderBars(model.sparkline, p, chartWidth, chartHeight);

  // Monotone, unlike the poster's chips: the receipt's restraint is the point,
  // and a row of coloured glyphs would compete with the values it leads.
  const iconSize = Math.round(width * 0.019);
  const statLines = lines
    .map(
      stat => `<div class="ln">
      ${renderIcon(stat.key, p.muted, iconSize, 0.75)}
      <span class="k">${escapeHtml(stat.label.toLowerCase())}</span>
      <span class="dots"></span>
      <span class="v" style="color:${toneColor(stat.tone, p)}">${escapeHtml(statDisplay(stat.key, stat.value))}</span>
    </div>`
    )
    .join('');

  const projectLines = model.projects
    .slice(0, square ? 3 : 2)
    .map(
      project => `<div class="ln sub">
      <span class="k">${escapeHtml(project.name)}</span>
      <span class="dots"></span>
      <span class="v">${project.share}%</span>
    </div>`
    )
    .join('');

  const dates = model.sparklineDates;
  const axis = dates.length
    ? `<div class="axis"><span>${escapeHtml(dayjs(dates[0]).format('MMM D'))}</span><span>${escapeHtml(dayjs(dates[dates.length - 1]).format('MMM D'))}</span></div>`
    : '';

  return `<!doctype html>
<meta charset="utf-8">
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    width: ${width}px; height: ${height}px; position: relative; overflow: hidden;
    background: ${p.bg}; color: ${p.text}; font-family: ${MONO};
    padding: ${pad}px; display: flex; flex-direction: column;
    -webkit-font-smoothing: antialiased;
  }
  /* A single accent rail down the left edge: cheap, and it gives the card a
     recognisable silhouette in a timeline. */
  .rail {
    position: absolute; left: 0; top: 0; bottom: 0;
    width: ${Math.round(width * 0.008)}px;
    background: linear-gradient(${p.accent}, ${p.accentDeep});
  }
  .scan {
    position: absolute; inset: 0;
    background: repeating-linear-gradient(
      ${p.text}00 0px, ${p.text}00 3px, ${p.text}06 3px, ${p.text}06 4px);
  }
  .top { display: flex; align-items: center; justify-content: space-between; position: relative; }
  .brand { display: flex; align-items: center; gap: ${Math.round(width * 0.01)}px;
    font-weight: 700; font-size: ${Math.round(width * 0.019)}px; letter-spacing: 0.02em; }
  .period { font-size: ${Math.round(width * 0.017)}px; color: ${p.muted}; }
  .rule { border-top: 1px dashed ${p.line}; margin: ${Math.round(pad * (square ? 0.4 : 0.5))}px 0; }
  .cols {
    position: relative; display: flex; flex: 1; min-height: 0;
    ${square ? 'flex-direction: column;' : `flex-direction: row; gap: ${Math.round(width * 0.05)}px;`}
  }
  .col-l { ${square ? '' : `width: ${Math.round((width - pad * 2) * 0.46)}px; flex: none;`} display: flex; flex-direction: column; }
  .col-r { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
  .hero { position: relative; margin-top: ${Math.round(pad * (square ? 0.5 : 0.1))}px; }
  .hero-v {
    font-size: ${Math.round(width * (square ? 0.185 : 0.14))}px; font-weight: 700;
    line-height: 0.9; letter-spacing: -0.05em; color: ${p.accent};
  }
  .hero-l {
    font-size: ${Math.round(width * 0.019)}px; color: ${p.muted};
    letter-spacing: 0.18em; text-transform: uppercase; margin-top: ${Math.round(width * 0.008)}px;
  }
  .chart { margin: ${Math.round(pad * (square ? 0.45 : 0.55))}px 0 ${Math.round(pad * 0.3)}px;
    line-height: 0; position: relative; }
  .axis { display: flex; justify-content: space-between; position: relative;
    font-size: ${Math.round(width * 0.0135)}px; color: ${p.muted}; }
  .body { position: relative; display: flex; flex-direction: column;
    gap: ${Math.round(width * (square ? 0.009 : 0.013))}px;
    ${square ? `margin-top: ${Math.round(pad * 0.7)}px;` : ''} }
  .ln { display: flex; align-items: baseline; gap: 10px; font-size: ${Math.round(width * 0.0195)}px; }
  /* Nudged onto the baseline: a flex baseline does not apply to an svg, which
     would otherwise sit on the line's bottom edge rather than with the text. */
  .ln svg { align-self: center; transform: translateY(${Math.round(width * 0.0012)}px); }
  .ln.sub { font-size: ${Math.round(width * 0.0165)}px; color: ${p.muted}; }
  .k { white-space: nowrap; }
  .dots { flex: 1; border-bottom: 1px dotted ${p.faint}; transform: translateY(-4px); }
  .v { font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .foot {
    position: relative; display: flex; align-items: center; justify-content: space-between;
    margin-top: ${Math.round(pad * 0.55)}px; padding-top: ${Math.round(pad * 0.4)}px;
    border-top: 1px dashed ${p.line};
    font-size: ${Math.round(width * 0.0155)}px; color: ${p.muted};
  }
</style>
<div class="rail"></div>
<div class="scan"></div>
<div class="top">
  <span class="brand">${renderLogo(p, Math.round(width * 0.0137))}barnacles report</span>
  <span class="period">${escapeHtml(model.periodLabel)}</span>
</div>
<div class="rule"></div>
<div class="cols">
  <div class="col-l">
    <div class="hero">
      <div class="hero-v">${escapeHtml(statDisplay(hero.key, hero.value))}</div>
      <div class="hero-l">${escapeHtml(hero.label)}</div>
    </div>
    <div class="chart">${chart}</div>
    ${axis}
  </div>
  <div class="col-r">
    <div class="body">${statLines}${projectLines ? `<div class="rule"></div>${projectLines}` : ''}</div>
  </div>
</div>
<div class="foot"><span>${escapeHtml(model.scopeLabel)}</span><span>${escapeHtml(model.attribution)}</span></div>
`;
}
