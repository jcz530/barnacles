/**
 * Color conversion utilities for converting between different CSS color formats
 * Uses culori for accurate conversions including modern formats like OKLCH
 */

import { converter, formatCss, formatHex, formatRgb, parse } from 'culori';

export interface ColorFormats {
  hex: string;
  rgb: string;
  rgba: string;
  hsl: string;
  hsla: string;
  lch: string;
  oklch: string;
}

/**
 * Round a number to a specified number of decimal places
 */
function roundTo(value: number, decimals: number): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/**
 * Parse various color input formats and convert to all formats
 */
export function convertColor(input: string, alpha: number = 1): ColorFormats | null {
  // Parse the input color
  const parsed = parse(input);
  if (!parsed) return null;

  // Set alpha if provided
  const colorWithAlpha = { ...parsed, alpha };

  // Convert to different color spaces
  const toRgb = converter('rgb');
  const toHsl = converter('hsl');
  const toLch = converter('lch');
  const toOklch = converter('oklch');

  const rgbColor = toRgb(colorWithAlpha);
  const hslColor = toHsl(colorWithAlpha);
  const lchColor = toLch(colorWithAlpha);
  const oklchColor = toOklch(colorWithAlpha);

  if (!rgbColor || !hslColor || !lchColor || !oklchColor) return null;

  // Format as strings with proper decimal precision
  const hex = formatHex(rgbColor);

  // RGB: integers 0-255
  const rgb = `rgb(${Math.round(rgbColor.r * 255)}, ${Math.round(rgbColor.g * 255)}, ${Math.round(rgbColor.b * 255)})`;
  const rgba =
    alpha !== 1
      ? `rgba(${Math.round(rgbColor.r * 255)}, ${Math.round(rgbColor.g * 255)}, ${Math.round(rgbColor.b * 255)}, ${alpha})`
      : rgb;

  // HSL: hue=0 decimals, s/l=1 decimal
  const h = hslColor.h !== undefined ? Math.round(hslColor.h) : 0;
  const s = roundTo((hslColor.s ?? 0) * 100, 1);
  const l = roundTo((hslColor.l ?? 0) * 100, 1);
  const hsl = `hsl(${h}, ${s}%, ${l}%)`;
  const hsla = alpha !== 1 ? `hsla(${h}, ${s}%, ${l}%, ${alpha})` : hsl;

  // LCH: l=1 decimal, c=1 decimal, h=1 decimal
  const lchL = roundTo(lchColor.l ?? 0, 1);
  const lchC = roundTo(lchColor.c ?? 0, 1);
  const lchH = lchColor.h !== undefined ? roundTo(lchColor.h, 1) : 0;
  const lch = `lch(${lchL} ${lchC} ${lchH})`;

  // OKLCH: l=2 decimals, c=3 decimals, h=1 decimal
  const oklchL = roundTo(oklchColor.l, 2);
  const oklchC = roundTo(oklchColor.c, 3);
  const oklchH = oklchColor.h !== undefined ? roundTo(oklchColor.h, 1) : 0;
  const oklch = `oklch(${oklchL} ${oklchC} ${oklchH})`;

  return {
    hex,
    rgb,
    rgba,
    hsl,
    hsla,
    lch,
    oklch,
  };
}

/**
 * Legacy compatibility exports
 */

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const parsed = parse(hex);
  if (!parsed) return null;
  const rgb = converter('rgb')(parsed);
  if (!rgb) return null;
  return {
    r: Math.round(rgb.r * 255),
    g: Math.round(rgb.g * 255),
    b: Math.round(rgb.b * 255),
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  return formatHex({ mode: 'rgb', r: r / 255, g: g / 255, b: b / 255 });
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const hsl = converter('hsl')({ mode: 'rgb', r: r / 255, g: g / 255, b: b / 255 });
  if (!hsl) return { h: 0, s: 0, l: 0 };
  return {
    h: Math.round((hsl.h ?? 0) * 10) / 10,
    s: Math.round((hsl.s ?? 0) * 100),
    l: Math.round((hsl.l ?? 0) * 100),
  };
}

export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const rgb = converter('rgb')({ mode: 'hsl', h, s: s / 100, l: l / 100 });
  if (!rgb) return { r: 0, g: 0, b: 0 };
  return {
    r: Math.round(rgb.r * 255),
    g: Math.round(rgb.g * 255),
    b: Math.round(rgb.b * 255),
  };
}
