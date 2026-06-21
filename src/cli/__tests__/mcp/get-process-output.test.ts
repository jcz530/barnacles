import { describe, expect, it, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerGetProcessOutputTool } from '@cli/mcp/tools/get-process-output.js';
import { apiClient } from '@cli/utils/api-client.js';

vi.mock('@cli/utils/api-client.js', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

function createServer(): McpServer {
  return new McpServer({ name: 'test', version: '1.0.0' });
}

const fakeOutput = {
  output: 'line1\nline2\n',
  lines: ['line1\n', 'line2\n'],
};

describe('get_process_output tool', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
  });

  it('calls GET /api/processes/:id/output with the default line count', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(fakeOutput);
    const tool = registerGetProcessOutputTool(createServer());

    const result = await tool.handler({ processId: 'p1' }, {} as never);

    expect(apiClient.get).toHaveBeenCalledWith('/api/processes/p1/output?lines=200');
    expect(result.isError).toBeFalsy();
    expect(result.content[0]).toEqual({ type: 'text', text: fakeOutput.output });
  });

  it('passes a custom line count through to the API', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(fakeOutput);
    const tool = registerGetProcessOutputTool(createServer());

    await tool.handler({ processId: 'p1', lines: 50 }, {} as never);

    expect(apiClient.get).toHaveBeenCalledWith('/api/processes/p1/output?lines=50');
  });

  it('returns an error result when the API call fails', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Process not found'));
    const tool = registerGetProcessOutputTool(createServer());

    const result = await tool.handler({ processId: 'missing' }, {} as never);

    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual({ type: 'text', text: 'Process not found' });
  });
});
