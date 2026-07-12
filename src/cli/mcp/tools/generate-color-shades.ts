import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  checkShadeContrast,
  generateShades,
  type Shade,
} from '../../../shared/utilities/shade-generator.js';
import { exportPalette, type ExportFormat } from '../../../shared/utilities/palette-exporter.js';

/**
 * Render a shade as an ANSI-colored swatch line for terminal MCP clients.
 * Falls back to a plain text line if the hex can't be parsed.
 */
function formatShadeSwatch(shade: Shade, isBase: boolean): string {
  const rgbMatch = shade.hex.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  let colorBlock = '    ';
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 16);
    const g = parseInt(rgbMatch[2], 16);
    const b = parseInt(rgbMatch[3], 16);
    colorBlock = `\x1b[48;2;${r};${g};${b}m    \x1b[0m`;
  }

  const contrast = checkShadeContrast(shade.hex);
  const whiteText = contrast.white >= 4.5 ? '✓' : '✗';
  const blackText = contrast.black >= 4.5 ? '✓' : '✗';
  const baseBadge = isBase ? ' [BASE]' : '';

  return `  ${colorBlock}  ${shade.name.padEnd(4)} ${shade.hex.padEnd(8)} W:${whiteText} B:${blackText}${baseBadge}`;
}

export function registerGenerateColorShadesTool(server: McpServer): RegisteredTool {
  return server.registerTool(
    'generate_color_shades',
    {
      title: 'Generate Color Shades',
      description:
        'Generate a perceptually-uniform color palette (shades) from a base CSS color using OKLCH. ' +
        'Returns structured JSON plus an ANSI-colored swatch preview for terminal display. ' +
        'Optionally export the palette as CSS variables, Tailwind 3/4 config, or SCSS.',
      inputSchema: {
        baseColor: z.string().describe('Base color in any CSS format (e.g. "#3b82f6")'),
        count: z
          .number()
          .int()
          .min(2)
          .max(20)
          .optional()
          .describe('Number of shades to generate (default: 11)'),
        algorithm: z
          .enum(['tailwind', 'vibrant', 'natural'])
          .optional()
          .describe('Shade generation algorithm preset (default: tailwind)'),
        exportFormat: z
          .enum(['css', 'tailwind3', 'tailwind4', 'scss', 'json'])
          .optional()
          .describe('If provided, also include the palette serialized in this format'),
        colorName: z
          .string()
          .optional()
          .describe('Name to use for the color in the export output (default: "primary")'),
      },
    },
    async ({ baseColor, count, algorithm, exportFormat, colorName }) => {
      const palette = generateShades({ baseColor, count, algorithm });

      if (!palette) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Could not parse color: "${baseColor}"` }],
        };
      }

      const swatchPreview = palette.shades
        .map((shade, index) => formatShadeSwatch(shade, index === palette.baseShadeIndex))
        .join('\n');

      const content: Array<{ type: 'text'; text: string }> = [
        { type: 'text', text: swatchPreview },
        { type: 'text', text: JSON.stringify(palette, null, 2) },
      ];

      if (exportFormat) {
        const exported = exportPalette(
          palette,
          exportFormat as ExportFormat,
          colorName ?? 'primary'
        );
        content.push({ type: 'text', text: exported });
      }

      return { content };
    }
  );
}
