import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient } from '../../utils/api-client.js';
import { API_ROUTES } from '../../../shared/constants/index.js';
import type { ProjectWithDetails } from '../../../shared/types/api.js';

export function registerGetProjectByPathTool(server: McpServer): RegisteredTool {
  return server.registerTool(
    'get_project_by_path',
    {
      title: 'Get Project By Path',
      description:
        'Resolve a filesystem path (e.g. the current working directory) to the Barnacles project that contains it. Use this instead of list_projects when you already know the path you are working in — it is much cheaper and avoids scanning every tracked project.',
      inputSchema: {
        path: z
          .string()
          .describe('Absolute filesystem path to resolve, e.g. the current working directory'),
      },
    },
    async ({ path }) => {
      try {
        const project = await apiClient.get<ProjectWithDetails>(API_ROUTES.PROJECTS_BY_PATH(path));

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
