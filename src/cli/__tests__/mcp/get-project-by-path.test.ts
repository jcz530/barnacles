import { describe, expect, it, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerGetProjectByPathTool } from '@cli/mcp/tools/get-project-by-path.js';
import { apiClient } from '@cli/utils/api-client.js';
import type { ProjectWithDetails } from '@shared/types/api.js';

vi.mock('@cli/utils/api-client.js', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

function createServer(): McpServer {
  return new McpServer({ name: 'test', version: '1.0.0' });
}

const fakeProject: ProjectWithDetails = {
  id: 'proj-1',
  name: 'barnacles',
  path: '/Users/dev/barnacles',
  isFavorite: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  technologies: [],
};

describe('get_project_by_path tool', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it('calls GET /api/projects/meta/by-path with the encoded path', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(fakeProject);
    const tool = registerGetProjectByPathTool(createServer());

    const result = await tool.handler({ path: '/Users/dev/barnacles/src' }, {} as never);

    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/projects/meta/by-path?path=' + encodeURIComponent('/Users/dev/barnacles/src')
    );
    expect(result.isError).toBeFalsy();
    expect(result.content[0]).toEqual({
      type: 'text',
      text: JSON.stringify(fakeProject, null, 2),
    });
  });

  it('returns an error result when no project contains the path', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(
      new Error('No project found containing path "/nowhere"')
    );
    const tool = registerGetProjectByPathTool(createServer());

    const result = await tool.handler({ path: '/nowhere' }, {} as never);

    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual({
      type: 'text',
      text: 'No project found containing path "/nowhere"',
    });
  });
});
