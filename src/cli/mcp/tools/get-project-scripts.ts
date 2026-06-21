import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient } from '../../utils/api-client.js';
import { API_ROUTES } from '../../../shared/constants/index.js';

export function registerGetProjectScriptsTool(server: McpServer): RegisteredTool {
  return server.registerTool(
    'get_project_scripts',
    {
      description:
        "Get a project's available run scripts: package.json scripts, composer.json scripts, and the detected package manager (npm, yarn, or pnpm). Use list_projects first to find the project ID.",
      inputSchema: {
        projectId: z.string().describe('The ID of the project to look up scripts for'),
      },
    },
    async ({ projectId }) => {
      try {
        const [packageScripts, composerScripts, packageManager] = await Promise.all([
          apiClient.get<Record<string, string>>(API_ROUTES.PROJECTS_PACKAGE_SCRIPTS(projectId)),
          apiClient.get<Record<string, string>>(API_ROUTES.PROJECTS_COMPOSER_SCRIPTS(projectId)),
          apiClient.get<string>(API_ROUTES.PROJECTS_PACKAGE_MANAGER(projectId)),
        ]);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ packageScripts, composerScripts, packageManager }, null, 2),
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
