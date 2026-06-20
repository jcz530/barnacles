import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient } from '../../utils/api-client.js';
import { API_ROUTES } from '../../../shared/constants/index.js';

interface HostsEntry {
  id: string;
  ip: string;
  hostname: string;
}

export function registerGetHostsEntriesTool(server: McpServer): RegisteredTool {
  return server.registerTool(
    'get_hosts_entries',
    {
      description:
        "List entries from the system's hosts file (e.g. local domain overrides like myapp.local).",
      inputSchema: {},
    },
    async () => {
      try {
        const entries = await apiClient.get<HostsEntry[]>(API_ROUTES.SYSTEM_HOSTS);

        return {
          content: [{ type: 'text', text: JSON.stringify(entries, null, 2) }],
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
