import { describe, expect, it } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerGenerateColorShadesTool } from '@cli/mcp/tools/generate-color-shades.js';

function createServer(): McpServer {
  return new McpServer({ name: 'test', version: '1.0.0' });
}

describe('generate_color_shades tool', () => {
  it('generates a palette with a swatch preview and JSON content', async () => {
    const tool = registerGenerateColorShadesTool(createServer());

    const result = await tool.handler({ baseColor: '#3b82f6' }, {} as never);

    expect(result.isError).toBeFalsy();
    expect(result.content).toHaveLength(2);

    const swatchText = (result.content[0] as { text: string }).text;
    expect(swatchText).toContain('\x1b[48;2;');

    const palette = JSON.parse((result.content[1] as { text: string }).text);
    expect(palette.baseColor).toBe('#3b82f6');
    expect(palette.shades).toHaveLength(11);
  });

  it('respects a custom count and includes an export block when requested', async () => {
    const tool = registerGenerateColorShadesTool(createServer());

    const result = await tool.handler(
      { baseColor: '#3b82f6', count: 5, exportFormat: 'css', colorName: 'brand' },
      {} as never
    );

    expect(result.content).toHaveLength(3);
    const palette = JSON.parse((result.content[1] as { text: string }).text);
    expect(palette.shades).toHaveLength(5);

    const exported = (result.content[2] as { text: string }).text;
    expect(exported).toContain('--color-brand-');
  });

  it('returns an error result for unparseable input', async () => {
    const tool = registerGenerateColorShadesTool(createServer());

    const result = await tool.handler({ baseColor: 'not-a-color' }, {} as never);

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('Could not parse color');
  });
});
