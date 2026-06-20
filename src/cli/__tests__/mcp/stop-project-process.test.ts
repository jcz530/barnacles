import { describe, expect, it, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerStopProjectProcessTool } from '@cli/mcp/tools/stop-project-process.js';
import { apiClient } from '@cli/utils/api-client.js';

vi.mock('@cli/utils/api-client.js', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

function createServer(): McpServer {
  return new McpServer({ name: 'test', version: '1.0.0' });
}

describe('stop_project_process tool', () => {
  beforeEach(() => {
    vi.mocked(apiClient.post).mockReset();
  });

  it('calls POST /api/projects/:id/stop with the given project ID', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(undefined);
    const tool = registerStopProjectProcessTool(createServer());

    const result = await tool.handler({ projectId: 'proj-1' }, {} as never);

    expect(apiClient.post).toHaveBeenCalledWith('/api/projects/proj-1/stop');
    expect(result.isError).toBeFalsy();
    expect(result.content[0]).toEqual({
      type: 'text',
      text: 'Stopped all processes for project proj-1.',
    });
  });

  it('returns an error result when the project is not found', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('Project not found'));
    const tool = registerStopProjectProcessTool(createServer());

    const result = await tool.handler({ projectId: 'missing' }, {} as never);

    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual({ type: 'text', text: 'Project not found' });
  });
});
