import { describe, expect, it, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerGetHostsEntriesTool } from '@cli/mcp/tools/get-hosts-entries.js';
import { apiClient } from '@cli/utils/api-client.js';

vi.mock('@cli/utils/api-client.js', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

function createServer(): McpServer {
  return new McpServer({ name: 'test', version: '1.0.0' });
}

const fakeEntries = [{ id: '127.0.0.1-myapp.local', ip: '127.0.0.1', hostname: 'myapp.local' }];

describe('get_hosts_entries tool', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it('calls GET /api/system/hosts and returns the entries', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(fakeEntries);
    const tool = registerGetHostsEntriesTool(createServer());

    const result = await tool.handler({}, {} as never);

    expect(apiClient.get).toHaveBeenCalledWith('/api/system/hosts');
    expect(result.isError).toBeFalsy();
    expect(result.content[0]).toEqual({ type: 'text', text: JSON.stringify(fakeEntries, null, 2) });
  });

  it('returns an error result when the hosts file cannot be read', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Failed to read hosts file'));
    const tool = registerGetHostsEntriesTool(createServer());

    const result = await tool.handler({}, {} as never);

    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual({ type: 'text', text: 'Failed to read hosts file' });
  });
});
