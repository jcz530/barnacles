import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient } from '../../utils/api-client.js';
import { API_ROUTES } from '../../../shared/constants/index.js';

export function registerStartProjectProcessTool(server: McpServer): RegisteredTool {
  return server.registerTool(
    'start_project_process',
    {
      description:
        "Start all of a project's configured dev processes (the same processes started by the 'Start Processes' action in the app). Use list_projects first to find the project ID.",
      inputSchema: {
        projectId: z.string().describe('The ID of the project to start processes for'),
      },
    },
    async ({ projectId }) => {
      try {
        const status = await apiClient.post(API_ROUTES.PROJECTS_START(projectId));

        return {
          content: [{ type: 'text', text: JSON.stringify(status, null, 2) }],
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
