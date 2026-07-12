import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { MAX_FILE_SIZE, stripExifData } from '../../../shared/utilities/exif-reader.js';

export function registerStripExifDataTool(server: McpServer): RegisteredTool {
  return server.registerTool(
    'strip_exif_data',
    {
      title: 'Strip EXIF Data',
      description:
        'Remove EXIF metadata (including GPS location) from a JPEG image and write the result to a new file. ' +
        'Only JPEG/JPG images are supported. The original file is never modified; an output path must be provided.',
      inputSchema: {
        imagePath: z.string().describe('Path to the source JPEG image'),
        outputPath: z
          .string()
          .describe('Path to write the stripped image to (must differ from imagePath)'),
      },
    },
    async ({ imagePath, outputPath }) => {
      if (path.resolve(imagePath) === path.resolve(outputPath)) {
        return {
          isError: true,
          content: [{ type: 'text', text: 'outputPath must be different from imagePath.' }],
        };
      }

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
        const result = await stripExifData(arrayBuffer, 'image/jpeg');

        if (!result.success) {
          return {
            isError: true,
            content: [{ type: 'text', text: result.error ?? 'Failed to strip EXIF data' }],
          };
        }

        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, Buffer.from(result.buffer));

        const originalSize = buffer.length;
        const strippedSize = result.buffer.byteLength;

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  outputPath,
                  originalSizeBytes: originalSize,
                  strippedSizeBytes: strippedSize,
                  savedBytes: originalSize - strippedSize,
                },
                null,
                2
              ),
            },
          ],
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
