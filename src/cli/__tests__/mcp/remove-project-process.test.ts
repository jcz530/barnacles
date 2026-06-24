import { describe, expect, it, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerRemoveProjectProcessTool } from '@cli/mcp/tools/remove-project-process.js';
import { apiClient } from '@cli/utils/api-client.js';
import type { StartProcess } from '@shared/types/process.js';

vi.mock('@cli/utils/api-client.js', () => ({
  apiClient: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

function createServer(): McpServer {
  return new McpServer({ name: 'test', version: '1.0.0' });
}

const existingProcesses: StartProcess[] = [
  { id: 'proc-1', name: 'dev', commands: ['npm run dev'] },
  { id: 'proc-2', name: 'worker', commands: ['npm run worker'] },
];

describe('remove_project_process tool', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.patch).mockReset();
  });

  it('removes the matching process and persists the rest', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(existingProcesses);
    vi.mocked(apiClient.patch).mockResolvedValue(undefined);
    const tool = registerRemoveProjectProcessTool(createServer());

    const result = await tool.handler({ projectId: 'proj-1', processId: 'proc-1' }, {} as never);

    expect(apiClient.get).toHaveBeenCalledWith('/api/projects/proj-1/start-processes');
    expect(apiClient.patch).toHaveBeenCalledWith('/api/projects/proj-1/start-processes', {
      startProcesses: [existingProcesses[1]],
    });
    expect(result.isError).toBeFalsy();
    expect(result.content[0]).toEqual({
      type: 'text',
      text: JSON.stringify([existingProcesses[1]], null, 2),
    });
  });

  it('returns an error result when processId does not match any existing process', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(existingProcesses);
    const tool = registerRemoveProjectProcessTool(createServer());

    const result = await tool.handler({ projectId: 'proj-1', processId: 'missing' }, {} as never);

    expect(apiClient.patch).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual({
      type: 'text',
      text: 'No process with id "missing" found for project proj-1.',
    });
  });

  it('returns an error result when the API call fails', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Project not found'));
    const tool = registerRemoveProjectProcessTool(createServer());

    const result = await tool.handler({ projectId: 'missing', processId: 'proc-1' }, {} as never);

    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual({ type: 'text', text: 'Project not found' });
  });
});
