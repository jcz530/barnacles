import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient } from '../../utils/api-client.js';
import { API_ROUTES } from '../../../shared/constants/index.js';

export function registerKillPortProcessTool(server: McpServer): RegisteredTool {
  return server.registerTool(
    'kill_port_process',
    {
      title: 'Kill Port Process',
      description:
        'Kill the process holding a given PID (e.g. to free up a port). Use list_ports first to find the PID. This is irreversible.',
      inputSchema: {
        pid: z.number().int().describe('The process ID to kill'),
      },
    },
    async ({ pid }) => {
      try {
        await apiClient.delete(API_ROUTES.PORTS_KILL(pid));

        return {
          content: [{ type: 'text', text: `Process ${pid} killed.` }],
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
