import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient } from '../../utils/api-client.js';
import { API_ROUTES } from '../../../shared/constants/index.js';

export function registerGetProjectReadmeTool(server: McpServer): RegisteredTool {
  return server.registerTool(
    'get_project_readme',
    {
      title: 'Get Project Readme',
      description:
        'Get the README.md content for a project. Use get_project_by_path if you know the project directory, or list_projects otherwise, to find the project ID.',
      inputSchema: {
        projectId: z.string().describe('The ID of the project to read the README for'),
      },
    },
    async ({ projectId }) => {
      try {
        const readme = await apiClient.get<string>(`${API_ROUTES.PROJECTS}/${projectId}/readme`);

        return {
          content: [{ type: 'text', text: readme }],
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
