import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient } from '../../utils/api-client.js';
import { API_ROUTES } from '../../../shared/constants/index.js';

interface ProcessOutputResult {
  output: string;
  lines: string[];
}

export function registerGetProcessOutputTool(server: McpServer): RegisteredTool {
  return server.registerTool(
    'get_process_output',
    {
      title: 'Get Process Output',
      description:
        'Get the recent output (stdout/stderr) of a running or stopped dev process. Use list_running_processes first to find the process ID. Defaults to the last 200 lines; pass lines to change how many.',
      inputSchema: {
        processId: z.string().describe('The ID of the process to get output for'),
        lines: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Number of most recent output lines to return (default 200)'),
      },
    },
    async ({ processId, lines }) => {
      try {
        const lineCount = lines ?? 200;
        const result = await apiClient.get<ProcessOutputResult>(
          `${API_ROUTES.PROCESS_OUTPUT(processId)}?lines=${lineCount}`
        );

        return {
          content: [{ type: 'text', text: result.output }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            { type: 'text', text: error instanceof Error ? error.message : 'Unknown error' },
          ],
        };
      }
    }
  );
}
