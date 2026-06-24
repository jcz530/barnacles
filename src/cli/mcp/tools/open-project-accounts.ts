import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient } from '../../utils/api-client.js';
import { API_ROUTES } from '../../../shared/constants/index.js';

export function registerOpenProjectAccountsTool(server: McpServer): RegisteredTool {
  return server.registerTool(
    'open_project_accounts',
    {
      title: 'Open Project Accounts',
      description:
        "Focus the Barnacles app window and navigate it to a project's Accounts tab, so the user can view a password themselves. Passwords are never returned to the assistant. Use get_project_by_path if you know the project directory, or list_projects otherwise, to find the project ID.",
      inputSchema: {
        projectId: z.string().describe('The ID of the project to open the Accounts tab for'),
      },
    },
    async ({ projectId }) => {
      try {
        await apiClient.post(API_ROUTES.SYSTEM_FOCUS_PROJECT, {
          path: `/projects/${projectId}/accounts`,
        });

        return {
          content: [
            {
              type: 'text',
              text: "Opened the Barnacles app to this project's Accounts tab for the user to view.",
            },
          ],
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
