import { describe, expect, it } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerConvertColorTool } from '@cli/mcp/tools/convert-color.js';

function createServer(): McpServer {
  return new McpServer({ name: 'test', version: '1.0.0' });
}

describe('convert_color tool', () => {
  it('converts a hex color to all formats', async () => {
    const tool = registerConvertColorTool(createServer());

    const result = await tool.handler({ color: '#3b82f6' }, {} as never);

    expect(result.isError).toBeFalsy();
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.hex).toBe('#3b82f6');
    expect(parsed.rgb).toMatch(/^rgb\(/);
    expect(parsed.hsl).toMatch(/^hsl\(/);
    expect(parsed.oklch).toMatch(/^oklch\(/);
  });

  it('applies alpha when provided', async () => {
    const tool = registerConvertColorTool(createServer());

    const result = await tool.handler({ color: '#3b82f6', alpha: 0.5 }, {} as never);

    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.rgba).toMatch(/0\.5\)$/);
  });

  it('returns an error result for unparseable input', async () => {
    const tool = registerConvertColorTool(createServer());

    const result = await tool.handler({ color: 'not-a-color' }, {} as never);

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('Could not parse color');
  });
});
