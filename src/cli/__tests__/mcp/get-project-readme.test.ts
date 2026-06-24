import { describe, expect, it, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerGetProjectReadmeTool } from '@cli/mcp/tools/get-project-readme.js';
import { apiClient } from '@cli/utils/api-client.js';

vi.mock('@cli/utils/api-client.js', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

function createServer(): McpServer {
  return new McpServer({ name: 'test', version: '1.0.0' });
}

describe('get_project_readme tool', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it('calls GET /api/projects/:id/readme and returns the content', async () => {
    vi.mocked(apiClient.get).mockResolvedValue('# My Project\n\nDescription here.');
    const tool = registerGetProjectReadmeTool(createServer());

    const result = await tool.handler({ projectId: 'proj-1' }, {} as never);

    expect(apiClient.get).toHaveBeenCalledWith('/api/projects/proj-1/readme');
    expect(result.isError).toBeFalsy();
    expect(result.content[0]).toEqual({
      type: 'text',
      text: '# My Project\n\nDescription here.',
    });
  });

  it('returns an error result when no README exists', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('README.md not found'));
    const tool = registerGetProjectReadmeTool(createServer());

    const result = await tool.handler({ projectId: 'proj-1' }, {} as never);

    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual({ type: 'text', text: 'README.md not found' });
  });
});
