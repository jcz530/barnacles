/**
 * Export color palettes in various formats for design systems
 */

import type { GeneratedPalette } from './shade-generator';
import { formatCss, formatHex, formatRgb, converter, parse } from 'culori';

export type ExportFormat = 'css' | 'tailwind3' | 'tailwind4' | 'scss' | 'json';
export type ColorFormat = 'hex' | 'rgb' | 'hsl' | 'oklch';

/**
 * Round a number to a specified number of decimal places
 */
function roundTo(value: number, decimals: number): number {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

/**
 * Convert a hex color to the specified format
 */
function convertColorFormat(hex: string, format: ColorFormat): string {
  const parsed = parse(hex);
  if (!parsed) return hex;

  switch (format) {
    case 'hex':
      return formatHex(parsed);
    case 'rgb': {
      const rgb = converter('rgb')(parsed);
      // Round RGB values to integers (0-255)
      if (rgb) {
        return `rgb(${Math.round(rgb.r * 255)}, ${Math.round(rgb.g * 255)}, ${Math.round(rgb.b * 255)})`;
      }
      return formatRgb(rgb);
    }
    case 'hsl': {
      const hsl = converter('hsl')(parsed);
      if (hsl) {
        // Round: hue to 0 decimals, saturation and lightness to 1 decimal
        const h = hsl.h !== undefined ? Math.round(hsl.h) : 0;
        const s = roundTo((hsl.s ?? 0) * 100, 1);
        const l = roundTo((hsl.l ?? 0) * 100, 1);
        return `hsl(${h}, ${s}%, ${l}%)`;
      }
      return formatCss(hsl);
    }
    case 'oklch': {
      const oklch = converter('oklch')(parsed);
      if (oklch) {
        // Round: lightness to 2 decimals, chroma to 3 decimals, hue to 1 decimal
        const l = roundTo(oklch.l, 2);
        const c = roundTo(oklch.c, 3);
        const h = oklch.h !== undefined ? roundTo(oklch.h, 1) : 0;
        return `oklch(${l} ${c} ${h})`;
      }
      return formatCss(oklch);
    }
    default:
      return hex;
  }
}

/**
 * Export palette as CSS custom properties
 */
export function exportAsCSS(
  palette: GeneratedPalette,
  colorName: string = 'primary',
  colorFormat: ColorFormat = 'hex'
): string {
  const lines = [`:root {`];

  palette.shades.forEach(shade => {
    const colorValue = convertColorFormat(shade.hex, colorFormat);
    lines.push(`  --color-${colorName}-${shade.name}: ${colorValue};`);
  });

  lines.push(`}`);
  return lines.join('\n');
}

/**
 * Export palette as Tailwind 3 config (JavaScript)
 */
export function exportAsTailwind3(
  palette: GeneratedPalette,
  colorName: string = 'primary',
  colorFormat: ColorFormat = 'hex'
): string {
  const lines = [
    `// tailwind.config.js (Tailwind CSS v3)`,
    `module.exports = {`,
    `  theme: {`,
    `    extend: {`,
    `      colors: {`,
    `        ${colorName}: {`,
  ];

  palette.shades.forEach(shade => {
    const colorValue = convertColorFormat(shade.hex, colorFormat);
    lines.push(`          ${shade.name}: '${colorValue}',`);
  });

  lines.push(`        },`, `      },`, `    },`, `  },`, `}`);
  return lines.join('\n');
}

/**
 * Export palette as Tailwind 4 config (CSS variables)
 */
export function exportAsTailwind4(
  palette: GeneratedPalette,
  colorName: string = 'primary',
  colorFormat: ColorFormat = 'hex'
): string {
  const lines = [`/* Tailwind CSS v4 - Add to your CSS file */`, `@theme {`];

  palette.shades.forEach(shade => {
    const colorValue = convertColorFormat(shade.hex, colorFormat);
    lines.push(`  --color-${colorName}-${shade.name}: ${colorValue};`);
  });

  lines.push(`}`);
  return lines.join('\n');
}

/**
 * Export palette as SCSS variables
 */
export function exportAsSCSS(
  palette: GeneratedPalette,
  colorName: string = 'primary',
  colorFormat: ColorFormat = 'hex'
): string {
  const lines: string[] = [];

  palette.shades.forEach(shade => {
    const colorValue = convertColorFormat(shade.hex, colorFormat);
    lines.push(`$${colorName}-${shade.name}: ${colorValue};`);
  });

  return lines.join('\n');
}

/**
 * Export palette as JSON
 */
export function exportAsJSON(
  palette: GeneratedPalette,
  colorName: string = 'primary',
  colorFormat: ColorFormat = 'hex'
): string {
  const colors: Record<string, string> = {};

  palette.shades.forEach(shade => {
    const colorValue = convertColorFormat(shade.hex, colorFormat);
    colors[shade.name] = colorValue;
  });

  return JSON.stringify({ [colorName]: colors }, null, 2);
}

/**
 * Export palette in the specified format
 */
export function exportPalette(
  palette: GeneratedPalette,
  format: ExportFormat,
  colorName: string = 'primary',
  colorFormat: ColorFormat = 'hex'
): string {
  switch (format) {
    case 'css':
      return exportAsCSS(palette, colorName, colorFormat);
    case 'tailwind3':
      return exportAsTailwind3(palette, colorName, colorFormat);
    case 'tailwind4':
      return exportAsTailwind4(palette, colorName, colorFormat);
    case 'scss':
      return exportAsSCSS(palette, colorName, colorFormat);
    case 'json':
      return exportAsJSON(palette, colorName, colorFormat);
    default:
      return exportAsTailwind3(palette, colorName, colorFormat);
  }
}

/**
 * Get all export formats for a palette
 */
export function getAllExports(
  palette: GeneratedPalette,
  colorName: string = 'primary',
  colorFormat: ColorFormat = 'hex'
): Record<ExportFormat, string> {
  return {
    css: exportAsCSS(palette, colorName, colorFormat),
    tailwind3: exportAsTailwind3(palette, colorName, colorFormat),
    tailwind4: exportAsTailwind4(palette, colorName, colorFormat),
    scss: exportAsSCSS(palette, colorName, colorFormat),
    json: exportAsJSON(palette, colorName, colorFormat),
  };
}
