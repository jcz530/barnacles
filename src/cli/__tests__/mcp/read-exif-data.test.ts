import { describe, expect, it, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerReadExifDataTool } from '@cli/mcp/tools/read-exif-data.js';
import { buildTestJpegWithExif } from './fixtures/test-jpeg.js';

function createServer(): McpServer {
  return new McpServer({ name: 'test', version: '1.0.0' });
}

describe('read_exif_data tool', () => {
  const tempFiles: string[] = [];

  afterEach(async () => {
    await Promise.all(tempFiles.splice(0).map(file => fs.rm(file, { force: true })));
  });

  async function writeTempJpeg(): Promise<string> {
    const filePath = path.join(
      os.tmpdir(),
      `barnacles-mcp-test-${Date.now()}-${Math.random()}.jpg`
    );
    await fs.writeFile(filePath, buildTestJpegWithExif());
    tempFiles.push(filePath);
    return filePath;
  }

  it('reads EXIF metadata from a JPEG file', async () => {
    const imagePath = await writeTempJpeg();
    const tool = registerReadExifDataTool(createServer());

    const result = await tool.handler({ imagePath }, {} as never);

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.categories.some((c: { name: string }) => c.name === 'Camera & EXIF')).toBe(true);
  });

  it('returns an error result when the file does not exist', async () => {
    const tool = registerReadExifDataTool(createServer());

    const result = await tool.handler({ imagePath: '/nonexistent/path/to/image.jpg' }, {} as never);

    expect(result.isError).toBe(true);
  });
});
