import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient } from '../../utils/api-client.js';
import { API_ROUTES } from '../../../shared/constants/index.js';
import type { ProjectProcessStatus } from '../../../shared/types/process.js';

export function registerListRunningProcessesTool(server: McpServer): RegisteredTool {
  return server.registerTool(
    'list_running_processes',
    {
      title: 'List Running Processes',
      description:
        'List the status of dev processes across all projects, running, stopped, or failed — use when checking whether a dev server or watcher is already up, or finding which processes belong to a project.',
      inputSchema: {},
    },
    async () => {
      try {
        const statuses = await apiClient.get<ProjectProcessStatus[]>(
          API_ROUTES.PROJECTS_PROCESS_STATUS
        );

        return {
          content: [{ type: 'text', text: JSON.stringify(statuses, null, 2) }],
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
