import { describe, expect, it, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerUpsertProjectProcessTool } from '@cli/mcp/tools/upsert-project-process.js';
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

const existingProcess: StartProcess = {
  id: 'proc-1',
  name: 'dev',
  commands: ['npm run dev'],
};

describe('upsert_project_process tool', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.patch).mockReset();
  });

  it('appends a new process when processId is omitted', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([existingProcess]);
    vi.mocked(apiClient.patch).mockResolvedValue(undefined);
    const tool = registerUpsertProjectProcessTool(createServer());

    const result = await tool.handler(
      { projectId: 'proj-1', name: 'worker', commands: ['npm run worker'] },
      {} as never
    );

    expect(apiClient.get).toHaveBeenCalledWith('/api/projects/proj-1/start-processes');
    const [, body] = vi.mocked(apiClient.patch).mock.calls[0];
    const updated = (body as { startProcesses: StartProcess[] }).startProcesses;
    expect(updated).toHaveLength(2);
    expect(updated[0]).toEqual(existingProcess);
    expect(updated[1]).toMatchObject({ name: 'worker', commands: ['npm run worker'] });
    expect(result.isError).toBeFalsy();
  });

  it('edits the matching process in place when processId is given', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([existingProcess]);
    vi.mocked(apiClient.patch).mockResolvedValue(undefined);
    const tool = registerUpsertProjectProcessTool(createServer());

    const result = await tool.handler(
      {
        projectId: 'proj-1',
        processId: 'proc-1',
        name: 'dev (renamed)',
        commands: ['npm run dev:watch'],
      },
      {} as never
    );

    const [, body] = vi.mocked(apiClient.patch).mock.calls[0];
    const updated = (body as { startProcesses: StartProcess[] }).startProcesses;
    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({
      id: 'proc-1',
      name: 'dev (renamed)',
      commands: ['npm run dev:watch'],
    });
    expect(result.isError).toBeFalsy();
  });

  it('returns an error result when processId does not match any existing process', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([existingProcess]);
    const tool = registerUpsertProjectProcessTool(createServer());

    const result = await tool.handler(
      { projectId: 'proj-1', processId: 'missing', name: 'dev', commands: ['npm run dev'] },
      {} as never
    );

    expect(apiClient.patch).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual({
      type: 'text',
      text: 'No process with id "missing" found for project proj-1.',
    });
  });

  it('returns an error result when the API call fails', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Project not found'));
    const tool = registerUpsertProjectProcessTool(createServer());

    const result = await tool.handler(
      { projectId: 'missing', name: 'dev', commands: ['npm run dev'] },
      {} as never
    );

    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual({ type: 'text', text: 'Project not found' });
  });
});
