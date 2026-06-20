import { describe, expect, it, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerGetProjectStatusTool } from '@cli/mcp/tools/get-project-status.js';
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
  stats: {
    id: 'stats-1',
    projectId: 'proj-1',
    gitBranch: 'main',
    hasUncommittedChanges: true,
    lastCommitMessage: 'fix bug',
  },
};

describe('get_project_status tool', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it('calls GET /api/projects/:id with the given project ID', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(fakeProject);
    const tool = registerGetProjectStatusTool(createServer());

    const result = await tool.handler({ projectId: 'proj-1' }, {} as never);

    expect(apiClient.get).toHaveBeenCalledWith('/api/projects/proj-1');
    expect(result.isError).toBeFalsy();
    expect(result.content[0]).toEqual({ type: 'text', text: JSON.stringify(fakeProject, null, 2) });
  });

  it('returns an error result when the project is not found', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('API error: 404 Not Found'));
    const tool = registerGetProjectStatusTool(createServer());

    const result = await tool.handler({ projectId: 'missing' }, {} as never);

    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual({ type: 'text', text: 'API error: 404 Not Found' });
  });
});
