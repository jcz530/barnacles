import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { convertColor } from '../../../shared/utilities/color-converter.js';

export function registerConvertColorTool(server: McpServer): RegisteredTool {
  return server.registerTool(
    'convert_color',
    {
      title: 'Convert Color',
      description:
        'Convert a CSS color (hex, rgb, hsl, named color, etc.) into hex, rgb, rgba, hsl, hsla, lch, and oklch formats.',
      inputSchema: {
        color: z
          .string()
          .describe(
            'The color to convert, in any CSS format (e.g. "#3b82f6", "rgb(59, 130, 246)", "royalblue")'
          ),
        alpha: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe('Alpha/opacity value from 0 to 1 (default: 1)'),
      },
    },
    async ({ color, alpha }) => {
      const result = convertColor(color, alpha);

      if (!result) {
        return {
          isError: true,
          content: [{ type: 'text', text: `Could not parse color: "${color}"` }],
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
