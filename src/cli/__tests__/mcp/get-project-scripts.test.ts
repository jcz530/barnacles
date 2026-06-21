import { describe, expect, it, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerGetProjectScriptsTool } from '@cli/mcp/tools/get-project-scripts.js';
import { apiClient } from '@cli/utils/api-client.js';

vi.mock('@cli/utils/api-client.js', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

function createServer(): McpServer {
  return new McpServer({ name: 'test', version: '1.0.0' });
}

describe('get_project_scripts tool', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it('fetches package scripts, composer scripts, and package manager', async () => {
    vi.mocked(apiClient.get).mockImplementation((endpoint: string) => {
      if (endpoint.endsWith('/package-scripts')) {
        return Promise.resolve({ dev: 'vite', build: 'vite build' });
      }
      if (endpoint.endsWith('/composer-scripts')) {
        return Promise.resolve({});
      }
      if (endpoint.endsWith('/package-manager')) {
        return Promise.resolve('npm');
      }
      throw new Error(`Unexpected endpoint: ${endpoint}`);
    });
    const tool = registerGetProjectScriptsTool(createServer());

    const result = await tool.handler({ projectId: 'proj-1' }, {} as never);

    expect(apiClient.get).toHaveBeenCalledWith('/api/projects/proj-1/package-scripts');
    expect(apiClient.get).toHaveBeenCalledWith('/api/projects/proj-1/composer-scripts');
    expect(apiClient.get).toHaveBeenCalledWith('/api/projects/proj-1/package-manager');
    expect(result.isError).toBeFalsy();
    expect(result.content[0]).toEqual({
      type: 'text',
      text: JSON.stringify(
        {
          packageScripts: { dev: 'vite', build: 'vite build' },
          composerScripts: {},
          packageManager: 'npm',
        },
        null,
        2
      ),
    });
  });

  it('returns an error result when the API call fails', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Project not found'));
    const tool = registerGetProjectScriptsTool(createServer());

    const result = await tool.handler({ projectId: 'proj-1' }, {} as never);

    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual({ type: 'text', text: 'Project not found' });
  });
});
