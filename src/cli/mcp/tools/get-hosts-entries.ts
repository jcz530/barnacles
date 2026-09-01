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
      title: 'Get Hosts Entries',
      description:
        'List local domain overrides from the system hosts file — use when a .local/.test domain needs checking, or when diagnosing why a hostname resolves unexpectedly.',
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
