import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient } from '../../utils/api-client.js';
import { API_ROUTES } from '../../../shared/constants/index.js';
import type { Account } from '../../../shared/types/api.js';

export function registerListProjectAccountsTool(server: McpServer): RegisteredTool {
  return server.registerTool(
    'list_project_accounts',
    {
      title: 'List Project Accounts',
      description:
        'List the accounts (logins) stored for a project, e.g. hosting or service credentials. Passwords are never included — use open_project_accounts to view a password in the app. Use get_project_by_path if you know the project directory, or list_projects otherwise, to find the project ID.',
      inputSchema: {
        projectId: z.string().describe('The ID of the project to list accounts for'),
      },
    },
    async ({ projectId }) => {
      try {
        const accounts = await apiClient.get<Account[]>(API_ROUTES.PROJECTS_ACCOUNTS(projectId));
        const sanitized = accounts.map(account => ({
          id: account.id,
          projectId: account.projectId,
          name: account.name,
          username: account.username,
          email: account.email,
          notes: account.notes,
          loginUrl: account.loginUrl,
          createdAt: account.createdAt,
          updatedAt: account.updatedAt,
        }));

        return {
          content: [{ type: 'text', text: JSON.stringify(sanitized, null, 2) }],
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
