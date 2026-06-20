import { describe, expect, it, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerListPortsTool } from '@cli/mcp/tools/list-ports.js';
import { apiClient } from '@cli/utils/api-client.js';
import type { PortEntry } from '@shared/types/api.js';

vi.mock('@cli/utils/api-client.js', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

function createServer(): McpServer {
  return new McpServer({ name: 'test', version: '1.0.0' });
}

const fakePorts: PortEntry[] = [
  {
    pid: 1234,
    port: 3001,
    protocol: 'TCP',
    processName: 'node',
    state: 'LISTEN',
  },
];

describe('list_ports tool', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it('calls GET /api/ports and returns the result', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(fakePorts);
    const tool = registerListPortsTool(createServer());

    const result = await tool.handler({}, {} as never);

    expect(apiClient.get).toHaveBeenCalledWith('/api/ports');
    expect(result.isError).toBeFalsy();
    expect(result.content[0]).toEqual({ type: 'text', text: JSON.stringify(fakePorts, null, 2) });
  });

  it('returns an error result when the API call fails', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('lsof unavailable'));
    const tool = registerListPortsTool(createServer());

    const result = await tool.handler({}, {} as never);

    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual({ type: 'text', text: 'lsof unavailable' });
  });
});
