/**
 * Export color palettes in various formats for design systems
 */

import type { GeneratedPalette } from './shade-generator';

export type ExportFormat = 'css' | 'tailwind' | 'scss' | 'json';

/**
 * Export palette as CSS custom properties
 */
export function exportAsCSS(palette: GeneratedPalette, colorName: string = 'primary'): string {
  const lines = [`:root {`];

  palette.shades.forEach(shade => {
    lines.push(`  --color-${colorName}-${shade.name}: ${shade.hex};`);
  });

  lines.push(`}`);
  return lines.join('\n');
}

/**
 * Export palette as Tailwind config
 */
export function exportAsTailwind(palette: GeneratedPalette, colorName: string = 'primary'): string {
  const lines = [
    `// tailwind.config.js`,
    `module.exports = {`,
    `  theme: {`,
    `    extend: {`,
    `      colors: {`,
    `        ${colorName}: {`,
  ];

  palette.shades.forEach(shade => {
    lines.push(`          ${shade.name}: '${shade.hex}',`);
  });

  lines.push(`        },`, `      },`, `    },`, `  },`, `}`);
  return lines.join('\n');
}

/**
 * Export palette as SCSS variables
 */
export function exportAsSCSS(palette: GeneratedPalette, colorName: string = 'primary'): string {
  const lines: string[] = [];

  palette.shades.forEach(shade => {
    lines.push(`$${colorName}-${shade.name}: ${shade.hex};`);
  });

  return lines.join('\n');
}

/**
 * Export palette as JSON
 */
export function exportAsJSON(palette: GeneratedPalette, colorName: string = 'primary'): string {
  const colors: Record<string, string> = {};

  palette.shades.forEach(shade => {
    colors[shade.name] = shade.hex;
  });

  return JSON.stringify({ [colorName]: colors }, null, 2);
}

/**
 * Export palette in the specified format
 */
export function exportPalette(
  palette: GeneratedPalette,
  format: ExportFormat,
  colorName: string = 'primary'
): string {
  switch (format) {
    case 'css':
      return exportAsCSS(palette, colorName);
    case 'tailwind':
      return exportAsTailwind(palette, colorName);
    case 'scss':
      return exportAsSCSS(palette, colorName);
    case 'json':
      return exportAsJSON(palette, colorName);
    default:
      return exportAsTailwind(palette, colorName);
  }
}

/**
 * Get all export formats for a palette
 */
export function getAllExports(
  palette: GeneratedPalette,
  colorName: string = 'primary'
): Record<ExportFormat, string> {
  return {
    css: exportAsCSS(palette, colorName),
    tailwind: exportAsTailwind(palette, colorName),
    scss: exportAsSCSS(palette, colorName),
    json: exportAsJSON(palette, colorName),
  };
}
