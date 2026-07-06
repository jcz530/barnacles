import { describe, expect, it, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerStripExifDataTool } from '@cli/mcp/tools/strip-exif-data.js';
import { registerReadExifDataTool } from '@cli/mcp/tools/read-exif-data.js';
import { buildTestJpegWithExif } from './fixtures/test-jpeg.js';

function createServer(): McpServer {
  return new McpServer({ name: 'test', version: '1.0.0' });
}

describe('strip_exif_data tool', () => {
  const tempFiles: string[] = [];

  afterEach(async () => {
    await Promise.all(tempFiles.splice(0).map(file => fs.rm(file, { force: true })));
  });

  function tempPath(suffix: string): string {
    const filePath = path.join(
      os.tmpdir(),
      `barnacles-mcp-test-${Date.now()}-${Math.random()}-${suffix}`
    );
    tempFiles.push(filePath);
    return filePath;
  }

  it('strips EXIF data and writes the result to outputPath', async () => {
    const imagePath = tempPath('source.jpg');
    const outputPath = tempPath('stripped.jpg');
    await fs.writeFile(imagePath, buildTestJpegWithExif());

    const tool = registerStripExifDataTool(createServer());
    const result = await tool.handler({ imagePath, outputPath }, {} as never);

    expect(result.isError).toBeFalsy();
    const summary = JSON.parse((result.content[0] as { text: string }).text);
    expect(summary.outputPath).toBe(outputPath);
    expect(summary.strippedSizeBytes).toBeLessThan(summary.originalSizeBytes);

    // Verify the stripped file no longer has EXIF data
    const readTool = registerReadExifDataTool(createServer());
    const readResult = await readTool.handler({ imagePath: outputPath }, {} as never);
    const parsed = JSON.parse((readResult.content[0] as { text: string }).text);
    expect(parsed.categories.some((c: { name: string }) => c.name === 'Camera & EXIF')).toBe(false);
  });

  it('rejects when outputPath matches imagePath', async () => {
    const imagePath = tempPath('same.jpg');
    await fs.writeFile(imagePath, buildTestJpegWithExif());

    const tool = registerStripExifDataTool(createServer());
    const result = await tool.handler({ imagePath, outputPath: imagePath }, {} as never);

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('must be different');
  });

  it('returns an error result when the source file does not exist', async () => {
    const tool = registerStripExifDataTool(createServer());

    const result = await tool.handler(
      { imagePath: '/nonexistent/source.jpg', outputPath: tempPath('out.jpg') },
      {} as never
    );

    expect(result.isError).toBe(true);
  });
});
