import { describe, expect, it } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTools } from '@cli/mcp/tools/index.js';
import { MCP_TOOLS, MCP_TOOL_CATEGORIES } from '@shared/constants/mcp-tools';

/**
 * The frontend renders MCP_TOOLS, but the real tools live in the CLI bundle
 * which the app cannot import. These tests are the only thing keeping the two
 * in sync — if a tool is added, renamed, or re-described without updating the
 * catalog, this fails.
 */
function registered() {
  return registerTools(new McpServer({ name: 'test', version: '1.0.0' }));
}

describe('MCP tool catalog parity', () => {
  it('covers exactly the registered tools', () => {
    const registeredNames = Object.keys(registered()).sort();
    const catalogNames = MCP_TOOLS.map(tool => tool.name).sort();

    expect(catalogNames).toEqual(registeredNames);
  });

  it('matches the registered title and description for every tool', () => {
    const tools = registered();

    for (const info of MCP_TOOLS) {
      const tool = tools[info.name];
      expect(tool, `${info.name} is not registered`).toBeDefined();
      expect(info.title, `${info.name} title`).toBe(tool.title);
      expect(info.description, `${info.name} description`).toBe(tool.description);
    }
  });

  it('gives every tool a known category', () => {
    const known = MCP_TOOL_CATEGORIES.map(category => category.value);

    for (const info of MCP_TOOLS) {
      expect(known, `${info.name} category`).toContain(info.category);
    }
  });

  it('has no duplicate tool names', () => {
    const names = MCP_TOOLS.map(tool => tool.name);

    expect(new Set(names).size).toBe(names.length);
  });

  it('describes every input parameter', () => {
    for (const info of MCP_TOOLS) {
      for (const input of info.inputs) {
        expect(input.name, `${info.name} input name`).toBeTruthy();
        expect(input.type, `${info.name}.${input.name} type`).toBeTruthy();
        expect(input.description, `${info.name}.${input.name} description`).toBeTruthy();
      }
    }
  });

  it('flags the irreversible tools as destructive', () => {
    const destructive = MCP_TOOLS.filter(tool => tool.destructive)
      .map(tool => tool.name)
      .sort();

    expect(destructive).toEqual(['kill_port_process', 'remove_project_process', 'strip_exif_data']);
  });
});
