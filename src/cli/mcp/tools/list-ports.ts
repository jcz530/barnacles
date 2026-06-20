import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient } from '../../utils/api-client.js';
import { API_ROUTES } from '../../../shared/constants/index.js';
import type { PortEntry } from '../../../shared/types/api.js';

export function registerListPortsTool(server: McpServer): RegisteredTool {
  return server.registerTool(
    'list_ports',
    {
      description:
        'List TCP ports currently in LISTEN state on the local machine, including PID, process name, and start time.',
      inputSchema: {},
    },
    async () => {
      try {
        const ports = await apiClient.get<PortEntry[]>(API_ROUTES.PORTS);

        return {
          content: [{ type: 'text', text: JSON.stringify(ports, null, 2) }],
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
