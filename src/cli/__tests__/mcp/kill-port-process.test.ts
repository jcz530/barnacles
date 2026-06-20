import { describe, expect, it, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerKillPortProcessTool } from '@cli/mcp/tools/kill-port-process.js';
import { apiClient } from '@cli/utils/api-client.js';

vi.mock('@cli/utils/api-client.js', () => ({
  apiClient: {
    delete: vi.fn(),
  },
}));

function createServer(): McpServer {
  return new McpServer({ name: 'test', version: '1.0.0' });
}

describe('kill_port_process tool', () => {
  beforeEach(() => {
    vi.mocked(apiClient.delete).mockReset();
  });

  it('calls DELETE /api/ports/:pid with the given pid', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue(undefined);
    const tool = registerKillPortProcessTool(createServer());

    const result = await tool.handler({ pid: 1234 }, {} as never);

    expect(apiClient.delete).toHaveBeenCalledWith('/api/ports/1234');
    expect(result.isError).toBeFalsy();
    expect(result.content[0]).toEqual({ type: 'text', text: 'Process 1234 killed.' });
  });

  it('returns an error result when the process is not found', async () => {
    vi.mocked(apiClient.delete).mockRejectedValue(new Error('Process not found'));
    const tool = registerKillPortProcessTool(createServer());

    const result = await tool.handler({ pid: 9999 }, {} as never);

    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual({ type: 'text', text: 'Process not found' });
  });
});
