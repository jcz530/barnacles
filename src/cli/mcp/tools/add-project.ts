import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient } from '../../utils/api-client.js';
import { API_ROUTES } from '../../../shared/constants/index.js';
import type { ProjectWithDetails } from '../../../shared/types/api.js';

interface AddProjectResponse {
  data: ProjectWithDetails;
  meta: {
    created: boolean;
    withinScanDirectories: boolean;
    suggestedScanDirectory: string | null;
  };
  message: string;
}

export function registerAddProjectTool(server: McpServer): RegisteredTool {
  return server.registerTool(
    'add_project',
    {
      title: 'Add Project',
      description:
        'Start tracking the project at a filesystem path — use when get_project_by_path found ' +
        'nothing and the directory should be tracked by Barnacles. Works for paths anywhere on ' +
        'disk, including outside the configured scan directories. Adding an already-tracked ' +
        'project just refreshes it.',
      inputSchema: {
        path: z
          .string()
          .describe('Absolute filesystem path to the project, e.g. the current working directory'),
      },
    },
    async ({ path }) => {
      try {
        const response = await apiClient.post<AddProjectResponse>(API_ROUTES.PROJECTS_ADD_BY_PATH, {
          path,
        });

        const { data, meta, message } = response;
        const lines = [message, JSON.stringify(data, null, 2)];

        // Surfaced so the assistant can offer add_scan_directory: a project
        // outside every scan directory is never re-discovered on its own.
        if (!meta.withinScanDirectories && meta.suggestedScanDirectory) {
          lines.push(
            `\nNote: this project is outside your configured scan directories, so future ` +
              `scans will not pick it up. Ask the user whether they want to add ` +
              `"${meta.suggestedScanDirectory}" as a scan directory, and only call ` +
              `add_scan_directory if they say yes.`
          );
        }

        return {
          content: [{ type: 'text', text: lines.join('\n') }],
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
