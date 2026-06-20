import { describe, expect, it, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerListProjectsTool } from '@cli/mcp/tools/list-projects.js';
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

const fakeProjects: ProjectWithDetails[] = [
  {
    id: 'proj-1',
    name: 'barnacles',
    path: '/Users/dev/barnacles',
    isFavorite: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    technologies: [],
  },
];

describe('list_projects tool', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it('calls GET /api/projects with no query params when no filters are given', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(fakeProjects);
    const tool = registerListProjectsTool(createServer());

    const result = await tool.handler({}, {} as never);

    expect(apiClient.get).toHaveBeenCalledWith('/api/projects');
    expect(result.isError).toBeFalsy();
    expect(result.content[0]).toEqual({
      type: 'text',
      text: JSON.stringify(fakeProjects, null, 2),
    });
  });

  it('passes search and technologies filters as query params', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(fakeProjects);
    const tool = registerListProjectsTool(createServer());

    await tool.handler({ search: 'barn', technologies: ['vue', 'rust'] }, {} as never);

    expect(apiClient.get).toHaveBeenCalledWith('/api/projects?search=barn&technologies=vue%2Crust');
  });

  it('returns an error result when the API call fails', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('API error: 500 Internal Server Error'));
    const tool = registerListProjectsTool(createServer());

    const result = await tool.handler({}, {} as never);

    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual({
      type: 'text',
      text: 'API error: 500 Internal Server Error',
    });
  });
});
