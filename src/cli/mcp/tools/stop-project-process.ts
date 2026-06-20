import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient } from '../../utils/api-client.js';
import { API_ROUTES } from '../../../shared/constants/index.js';

export function registerStopProjectProcessTool(server: McpServer): RegisteredTool {
  return server.registerTool(
    'stop_project_process',
    {
      description:
        "Stop all of a project's running dev processes (the same processes stopped by the 'Stop Processes' action in the app). Use list_projects first to find the project ID.",
      inputSchema: {
        projectId: z.string().describe('The ID of the project to stop processes for'),
      },
    },
    async ({ projectId }) => {
      try {
        await apiClient.post(API_ROUTES.PROJECTS_STOP(projectId));

        return {
          content: [{ type: 'text', text: `Stopped all processes for project ${projectId}.` }],
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
