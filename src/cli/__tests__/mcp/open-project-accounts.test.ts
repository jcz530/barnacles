import { describe, expect, it, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerOpenProjectAccountsTool } from '@cli/mcp/tools/open-project-accounts.js';
import { apiClient } from '@cli/utils/api-client.js';

vi.mock('@cli/utils/api-client.js', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

function createServer(): McpServer {
  return new McpServer({ name: 'test', version: '1.0.0' });
}

describe('open_project_accounts tool', () => {
  beforeEach(() => {
    vi.mocked(apiClient.post).mockReset();
  });

  it('focuses the app window on the project Accounts tab', async () => {
    vi.mocked(apiClient.post).mockResolvedValue(undefined);
    const tool = registerOpenProjectAccountsTool(createServer());

    const result = await tool.handler({ projectId: 'proj-1' }, {} as never);

    expect(apiClient.post).toHaveBeenCalledWith('/api/system/focus-project', {
      path: '/projects/proj-1/accounts',
    });
    expect(result.isError).toBeFalsy();
    expect(result.content[0]).toEqual({
      type: 'text',
      text: "Opened the Barnacles app to this project's Accounts tab for the user to view.",
    });
  });

  it('returns an error result when no main window is found', async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error('No main window found'));
    const tool = registerOpenProjectAccountsTool(createServer());

    const result = await tool.handler({ projectId: 'proj-1' }, {} as never);

    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual({ type: 'text', text: 'No main window found' });
  });
});
