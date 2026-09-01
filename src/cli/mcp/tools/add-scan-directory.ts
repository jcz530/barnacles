import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient } from '../../utils/api-client.js';
import { API_ROUTES } from '../../../shared/constants/index.js';

interface AddScanDirectoryResponse {
  data: {
    directories: string[];
    added: string;
    alreadyPresent: boolean;
  };
  message: string;
}

export function registerAddScanDirectoryTool(server: McpServer): RegisteredTool {
  return server.registerTool(
    'add_scan_directory',
    {
      title: 'Add Scan Directory',
      description:
        'Add a directory to the folders Barnacles scans for projects — use only after the user ' +
        'has been asked and agreed. This changes a persistent setting that affects every future ' +
        'scan, so offer it and wait for confirmation rather than calling it as an automatic ' +
        'follow-up to add_project. Pass the directory that contains the projects (e.g. ' +
        '"~/clients"), not an individual project. Adding a directory twice is harmless.',
      inputSchema: {
        path: z
          .string()
          .describe('Directory containing projects, e.g. "~/clients" or "/Volumes/ssd/code"'),
      },
    },
    async ({ path }) => {
      try {
        const response = await apiClient.post<AddScanDirectoryResponse>(
          API_ROUTES.SETTINGS_SCAN_DIRECTORIES,
          { path }
        );

        return {
          content: [
            {
              type: 'text',
              text: `${response.message}\n\nScan directories:\n${response.data.directories
                .map(dir => `  ${dir}`)
                .join('\n')}`,
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
