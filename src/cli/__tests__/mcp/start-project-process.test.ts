import { describe, expect, it, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerStartProjectProcessTool } from '@cli/mcp/tools/start-project-process.js';
import { apiClient } from '@cli/utils/api-client.js';

vi.mock('@cli/utils/api-client.js', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

function createServer(): McpServer {
  return new McpServer({ name: 'test', version: '1.0.0' });
}

describe('start_project_process tool', () => {
  beforeEach(() => {
    vi.mocked(apiClient.post).mockReset();
  });

  it('calls POST /api/projects/:id/start with the given project ID', async () => {
    const status = [{ name: 'dev', status: 'running' }];
    vi.mocked(apiClient.post).mockResolvedValue(status);
    const tool = registerStartProjectProcessTool(createServer());

    const result = await tool.handler({ projectId: 'proj-1' }, {} as never);

    expect(apiClient.post).toHaveBeenCalledWith('/api/projects/proj-1/start');
    expect(result.isError).toBeFalsy();
    expect(result.content[0]).toEqual({ type: 'text', text: JSON.stringify(status, null, 2) });
  });

  it('returns an error result when no processes are configured', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(
      new Error('No start processes configured for this project')
    );
    const tool = registerStartProjectProcessTool(createServer());

    const result = await tool.handler({ projectId: 'proj-1' }, {} as never);

    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual({
      type: 'text',
      text: 'No start processes configured for this project',
    });
  });
});
