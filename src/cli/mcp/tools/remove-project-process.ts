import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient } from '../../utils/api-client.js';
import { API_ROUTES } from '../../../shared/constants/index.js';
import type { StartProcess } from '../../../shared/types/process.js';

export function registerRemoveProjectProcessTool(server: McpServer): RegisteredTool {
  return server.registerTool(
    'remove_project_process',
    {
      title: 'Remove Project Process',
      description:
        "Remove a configured start process from a project. Use get_project_status or upsert_project_process to find a process's ID.",
      inputSchema: {
        projectId: z.string().describe('The ID of the project'),
        processId: z.string().describe('ID of the process to remove'),
      },
    },
    async ({ projectId, processId }) => {
      try {
        const existing = await apiClient.get<StartProcess[]>(
          API_ROUTES.PROJECTS_START_PROCESSES(projectId)
        );

        if (!existing.some(p => p.id === processId)) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: `No process with id "${processId}" found for project ${projectId}.`,
              },
            ],
          };
        }

        const updated = existing.filter(p => p.id !== processId);

        await apiClient.patch(API_ROUTES.PROJECTS_START_PROCESSES(projectId), {
          startProcesses: updated,
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(updated, null, 2) }],
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
