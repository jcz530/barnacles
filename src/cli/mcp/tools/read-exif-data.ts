import { z } from 'zod';
import fs from 'fs/promises';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { parseExifData } from '../../../shared/utilities/exif-reader.js';

export function registerReadExifDataTool(server: McpServer): RegisteredTool {
  return server.registerTool(
    'read_exif_data',
    {
      title: 'Read EXIF Data',
      description:
        'Read EXIF/IPTC/XMP metadata from an image file, including camera info and GPS location if present.',
      inputSchema: {
        imagePath: z.string().describe('Absolute or relative path to the image file'),
      },
    },
    async ({ imagePath }) => {
      try {
        const buffer = await fs.readFile(imagePath);
        const arrayBuffer = new Uint8Array(buffer).buffer;
        const exifData = parseExifData(arrayBuffer);

        return {
          content: [{ type: 'text', text: JSON.stringify(exifData, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            { type: 'text', text: error instanceof Error ? error.message : 'Unknown error' },
          ],
        };
      }
    }
  );
}
