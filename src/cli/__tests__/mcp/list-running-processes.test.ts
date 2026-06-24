import { describe, expect, it, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerListRunningProcessesTool } from '@cli/mcp/tools/list-running-processes.js';
import { apiClient } from '@cli/utils/api-client.js';
import type { ProjectProcessStatus } from '@shared/types/process.js';

vi.mock('@cli/utils/api-client.js', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

function createServer(): McpServer {
  return new McpServer({ name: 'test', version: '1.0.0' });
}

const fakeStatuses: ProjectProcessStatus[] = [
  {
    projectId: 'proj-1',
    processes: [{ processId: 'p1', name: 'dev', status: 'running' }],
  },
];

describe('list_running_processes tool', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it('calls GET /api/projects/process-status with no projectId', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(fakeStatuses);
    const tool = registerListRunningProcessesTool(createServer());

    const result = await tool.handler({}, {} as never);

    expect(apiClient.get).toHaveBeenCalledWith('/api/projects/process-status');
    expect(result.isError).toBeFalsy();
    expect(result.content[0]).toEqual({
      type: 'text',
      text: JSON.stringify(fakeStatuses, null, 2),
    });
  });

  it('returns an error result when the API call fails', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Failed to fetch process status'));
    const tool = registerListRunningProcessesTool(createServer());

    const result = await tool.handler({}, {} as never);

    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual({ type: 'text', text: 'Failed to fetch process status' });
  });
});
