import { z } from 'zod';
import { createId } from '@paralleldrive/cuid2';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient } from '../../utils/api-client.js';
import { API_ROUTES } from '../../../shared/constants/index.js';
import type { StartProcess } from '../../../shared/types/process.js';

export function registerUpsertProjectProcessTool(server: McpServer): RegisteredTool {
  return server.registerTool(
    'upsert_project_process',
    {
      title: 'Upsert Project Process',
      description:
        'Create a new start process for a project, or edit an existing one. Pass processId (from the data returned by this tool, or from list_running_processes) to edit that process in place; omit processId to create a new one. Use get_project_by_path if you know the project directory, or list_projects otherwise, to find the project ID, and get_project_scripts to find available commands.',
      inputSchema: {
        projectId: z.string().describe('The ID of the project to configure'),
        processId: z
          .string()
          .optional()
          .describe('ID of an existing process to edit; omit to create a new process'),
        name: z.string().describe('Display name for the process'),
        commands: z
          .array(z.string())
          .min(1)
          .describe('Shell commands to run in sequence (joined with &&)'),
        workingDir: z
          .string()
          .optional()
          .describe('Working directory relative to the project root'),
        color: z.string().optional().describe('Hex color for display in the app'),
        url: z.string().optional().describe('URL where the running process will be accessible'),
      },
    },
    async ({ projectId, processId, name, commands, workingDir, color, url }) => {
      try {
        const existing = await apiClient.get<StartProcess[]>(
          API_ROUTES.PROJECTS_START_PROCESSES(projectId)
        );

        let updated: StartProcess[];

        if (processId) {
          const index = existing.findIndex(p => p.id === processId);
          if (index === -1) {
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
          updated = [...existing];
          updated[index] = { id: processId, name, commands, workingDir, color, url };
        } else {
          updated = [...existing, { id: createId(), name, commands, workingDir, color, url }];
        }

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
