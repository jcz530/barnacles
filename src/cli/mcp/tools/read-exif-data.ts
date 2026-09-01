import { z } from 'zod';
import fs from 'fs/promises';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { MAX_FILE_SIZE, parseExifData } from '../../../shared/utilities/exif-reader.js';

export function registerReadExifDataTool(server: McpServer): RegisteredTool {
  return server.registerTool(
    'read_exif_data',
    {
      title: 'Read EXIF Data',
      description:
        "Inspect an image's embedded metadata — use when checking what camera, timestamp, or GPS location an image file carries, such as before publishing or sharing it. Reads EXIF, IPTC, and XMP data.",
      inputSchema: {
        imagePath: z.string().describe('Absolute or relative path to the image file'),
      },
    },
    async ({ imagePath }) => {
      try {
        const { size } = await fs.stat(imagePath);
        if (size > MAX_FILE_SIZE) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: `File is too large (${size} bytes). Maximum supported size is ${MAX_FILE_SIZE} bytes.`,
              },
            ],
          };
        }

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
