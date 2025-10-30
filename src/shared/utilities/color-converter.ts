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

  // Format as strings
  const hex = formatHex(rgbColor);
  const rgb = formatRgb({ ...rgbColor, alpha: undefined }); // RGB without alpha
  const rgba = formatRgb(rgbColor); // RGBA with alpha
  const hsl = formatCss({ ...hslColor, alpha: undefined });
  const hsla = formatCss(hslColor);
  const lch = formatCss({ ...lchColor, alpha: undefined });
  const oklch = formatCss(oklchColor);

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
