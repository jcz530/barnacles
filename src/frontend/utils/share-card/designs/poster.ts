import type { ShareModel, ShareSize } from '@shared/share/share-model';
import { statCapacity } from '../capacity';
import {
  escapeHtml,
  headline,
  iconColor,
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
 * "Poster" — one hero figure over a full-bleed commit curve.
 *
 * The card's job is to survive being scaled to a timeline thumbnail, so a
 * single number carries it and everything else supports. The chart is run edge
 * to edge as the card's shape rather than sitting in the middle as a widget.
 */

/**
 * Bars and curves both stop reading as data past a certain density, so the
 * curve is smoothed and the peak is marked rather than labelled — a shared
 * image has no hover to reveal anything.
 */
function renderCurve(
  values: number[],
  p: CardPalette,
  width: number,
  height: number,
  square: boolean
): string {
  if (values.length === 0) return '';

  const max = Math.max(...values, 1);
  const points = values.map((value, index) => {
    // A single point has no span to spread across, so it sits centred.
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - (value / max) * (height * 0.76) - height * 0.08;
    return [x, y] as const;
  });

  // Smoothed so it reads as a shape rather than a jagged widget. A lone point
  // draws no line at all, so it is left to the peak marker below.
  let path = `M ${points[0][0].toFixed(1)} ${points[0][1].toFixed(1)}`;
  for (let index = 1; index < points.length; index++) {
    const [x0, y0] = points[index - 1];
    const [x1, y1] = points[index];
    const midX = (x0 + x1) / 2;
    path += ` C ${midX.toFixed(1)} ${y0.toFixed(1)}, ${midX.toFixed(1)} ${y1.toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }

  const area = `${path} L ${width} ${height} L 0 ${height} Z`;
  const [peakX, peakY] = points[values.indexOf(max)] ?? points[0];

  return `<svg class="chart" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">
      <defs>
        <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${p.accent}" stop-opacity="0.34"/>
          <stop offset="100%" stop-color="${p.accent}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${area}" fill="url(#areaFill)"/>
      <path d="${path}" stroke="${p.accent}" stroke-width="${square ? 5 : 4}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
      <circle cx="${peakX.toFixed(1)}" cy="${peakY.toFixed(1)}" r="${square ? 11 : 9}" fill="${p.accent}" opacity="0.25"/>
      <circle cx="${peakX.toFixed(1)}" cy="${peakY.toFixed(1)}" r="${square ? 5.5 : 4.5}" fill="${p.accent}"/>
    </svg>`;
}

export function renderPoster(model: ShareModel, theme: CardTheme, size: ShareSize): string {
  const { width, height } = SIZES[size];
  const p = palette(theme);
  const square = size === 'square';
  const pad = Math.round(width * 0.055);

  const { hero, rest } = splitHero(model);
  // The hero takes one of the design's slots, so the chips get the remainder.
  const chips = rest.slice(0, Math.max(0, statCapacity('poster', size) - 1));

  const chartHeight = Math.round(height * (square ? 0.24 : 0.22));
  const chart = renderCurve(model.sparkline, p, width, chartHeight, square);

  const chipCells = chips
    .map(
      stat => `<div class="chip">
        ${renderIcon(stat.key, iconColor(stat.key, p), Math.round(width * 0.022))}
        <span class="chip-v" style="color:${toneColor(stat.tone, p)}">${escapeHtml(statDisplay(stat.key, stat.value))}</span>
        <span class="chip-l">${escapeHtml(stat.label)}</span>
      </div>`
    )
    .join('');

  const topProject = model.projects[0];
  const footLeft = topProject
    ? `Most active · <b>${escapeHtml(topProject.name)}</b>`
    : escapeHtml(model.scopeLabel);

  return `<!doctype html>
<meta charset="utf-8">
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    width: ${width}px; height: ${height}px; position: relative; overflow: hidden;
    background: ${p.bg}; color: ${p.text};
    font-family: ${theme.fontFamily};
    -webkit-font-smoothing: antialiased;
  }
  /* Ambient glow: gives the flat panel depth and puts the brand colour on the
     card at a size a thumbnail can actually register. */
  .glow {
    position: absolute; top: ${-Math.round(height * 0.42)}px; right: ${-Math.round(width * 0.18)}px;
    width: ${Math.round(width * 0.85)}px; height: ${Math.round(width * 0.85)}px; border-radius: 50%;
    background: radial-gradient(circle, ${p.accent}${theme.isDark ? '3d' : '2b'} 0%, ${p.accent}00 68%);
  }
  .grid {
    position: absolute; inset: 0;
    background-image:
      linear-gradient(${p.text}0a 1px, transparent 1px),
      linear-gradient(90deg, ${p.text}0a 1px, transparent 1px);
    background-size: ${Math.round(width / 24)}px ${Math.round(width / 24)}px;
    /* Only the alpha channel of a mask is read, so the colour is arbitrary —
       currentColor says that, where a literal hex would imply it mattered. */
    -webkit-mask-image: linear-gradient(to bottom, currentColor 0%, transparent 72%);
  }
  .chart { position: absolute; left: 0; right: 0; bottom: ${Math.round(pad * 1.55)}px; }
  .inner { position: relative; height: 100%; padding: ${pad}px; display: flex; flex-direction: column; }
  .top { display: flex; align-items: center; justify-content: space-between; }
  .brand { display: flex; align-items: center; gap: ${Math.round(width * 0.011)}px;
    font-weight: 700; font-size: ${Math.round(width * 0.021)}px; letter-spacing: -0.01em; }
  .eyebrow {
    font-size: ${Math.round(width * 0.0155)}px; letter-spacing: 0.14em;
    text-transform: uppercase; color: ${p.muted}; font-weight: 700;
  }
  /* The square has far more slack than the short card, so its headline and
     hero are centred in it rather than pinned to the top with a hole beneath. */
  .block { ${square ? `margin-top: ${Math.round(height * 0.11)}px;` : ''} }
  .headline {
    margin-top: ${Math.round(pad * (square ? 1.1 : 0.55))}px;
    font-size: ${Math.round(width * 0.028)}px; color: ${p.muted};
    font-weight: 400; letter-spacing: -0.01em;
  }
  .hero-v {
    font-size: ${Math.round(width * (square ? 0.225 : 0.145))}px; font-weight: 700;
    line-height: 0.86; letter-spacing: -0.045em;
    background: linear-gradient(160deg, ${p.text} 12%, ${p.accent} 130%);
    -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  .hero-l {
    font-size: ${Math.round(width * 0.023)}px; color: ${p.muted};
    margin-top: ${Math.round(width * (square ? 0.014 : 0.008))}px; letter-spacing: 0.02em;
  }
  .chips {
    /* Never wraps: the row is anchored to the bottom, so a second line would
       grow upward into the hero label and overprint it. A long value clips at
       the edge instead, which is recoverable by deselecting a stat. */
    display: flex; flex-wrap: nowrap; overflow: hidden; align-items: center;
    gap: ${Math.round(width * (square ? 0.02 : 0.014))}px ${Math.round(width * (square ? 0.022 : 0.019))}px;
    /* Pinned above the chart band rather than pushed there by auto margins,
       which would let the row sit inside it: the curve peak reaches the top of
       that band, so anything overlapping it collides with the data. */
    position: absolute; left: ${pad}px; right: ${pad}px;
    bottom: ${Math.round(chartHeight + pad * (square ? 0.7 : 1.15))}px;
  }
  .chip { display: flex; align-items: center; gap: ${Math.round(width * 0.0075)}px; }
  .chip-v { font-size: ${Math.round(width * (square ? 0.032 : 0.029))}px; font-weight: 700; letter-spacing: -0.03em; }
  /* Kept on one line: a wrapped label makes the row taller, which pushes it
     back up toward the hero the nowrap above is protecting. */
  .chip-l { font-size: ${Math.round(width * 0.0165)}px; color: ${p.muted}; white-space: nowrap; }
  .foot {
    position: absolute; left: ${pad}px; right: ${pad}px; bottom: ${Math.round(pad * 0.55)}px;
    display: flex; align-items: center; justify-content: space-between;
    font-size: ${Math.round(width * 0.0155)}px; color: ${p.muted};
  }
  .foot b { color: ${p.text}; }
</style>
<div class="glow"></div>
<div class="grid"></div>
${chart}
<div class="inner">
  <div class="top">
    <span class="brand">${renderLogo(p, Math.round(width * 0.0152))}Barnacles Report</span>
    <span class="eyebrow">${escapeHtml(model.periodLabel)}</span>
  </div>
  <div class="block">
    <div class="headline">${escapeHtml(headline(model))}</div>
    <div class="hero-v">${escapeHtml(statDisplay(hero.key, hero.value))}</div>
    <div class="hero-l">${escapeHtml(hero.label)}</div>
  </div>
  <div class="chips">${chipCells}</div>
</div>
<div class="foot"><span>${footLeft}</span><span>${escapeHtml(model.attribution)}</span></div>
`;
}
