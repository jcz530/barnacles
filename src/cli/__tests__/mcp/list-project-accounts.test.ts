import { describe, expect, it, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerListProjectAccountsTool } from '@cli/mcp/tools/list-project-accounts.js';
import { apiClient } from '@cli/utils/api-client.js';
import type { Account } from '@shared/types/api.js';

vi.mock('@cli/utils/api-client.js', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

function createServer(): McpServer {
  return new McpServer({ name: 'test', version: '1.0.0' });
}

const fakeAccount: Account = {
  id: 1,
  projectId: 'proj-1',
  name: 'AWS',
  username: 'admin',
  email: 'admin@example.com',
  password: 'super-secret',
  notes: null,
  loginUrl: 'https://aws.amazon.com',
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('list_project_accounts tool', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it('calls GET /api/projects/:id/accounts and strips passwords from the result', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([fakeAccount]);
    const tool = registerListProjectAccountsTool(createServer());

    const result = await tool.handler({ projectId: 'proj-1' }, {} as never);

    expect(apiClient.get).toHaveBeenCalledWith('/api/projects/proj-1/accounts');
    expect(result.isError).toBeFalsy();
    const text = (result.content[0] as { text: string }).text;
    expect(text).not.toContain('super-secret');
    expect(JSON.parse(text)).toEqual([
      {
        id: fakeAccount.id,
        projectId: fakeAccount.projectId,
        name: fakeAccount.name,
        username: fakeAccount.username,
        email: fakeAccount.email,
        notes: fakeAccount.notes,
        loginUrl: fakeAccount.loginUrl,
        createdAt: fakeAccount.createdAt.toISOString(),
        updatedAt: fakeAccount.updatedAt.toISOString(),
      },
    ]);
  });

  it('returns an error result when the API call fails', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Project not found'));
    const tool = registerListProjectAccountsTool(createServer());

    const result = await tool.handler({ projectId: 'missing' }, {} as never);

    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual({ type: 'text', text: 'Project not found' });
  });
});
