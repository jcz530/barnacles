import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient } from '../../utils/api-client.js';
import { API_ROUTES } from '../../../shared/constants/index.js';
import type { ProjectWithDetails } from '../../../shared/types/api.js';

export function registerGetProjectStatusTool(server: McpServer): RegisteredTool {
  return server.registerTool(
    'get_project_status',
    {
      title: 'Get Project Status',
      description:
        'Get the status of a single Barnacles project by ID: git branch, uncommitted changes, last commit, and stats. Use get_project_by_path if you know the project directory, or list_projects otherwise, to find the project ID.',
      inputSchema: {
        projectId: z.string().describe('The ID of the project to look up'),
      },
    },
    async ({ projectId }) => {
      try {
        const project = await apiClient.get<ProjectWithDetails>(
          `${API_ROUTES.PROJECTS}/${projectId}`
        );

        return {
          content: [{ type: 'text', text: JSON.stringify(project, null, 2) }],
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
