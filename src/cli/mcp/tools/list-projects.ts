import { z } from 'zod';
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiClient } from '../../utils/api-client.js';
import { API_ROUTES } from '../../../shared/constants/index.js';
import type { ProjectWithDetails } from '../../../shared/types/api.js';

export function registerListProjectsTool(server: McpServer): RegisteredTool {
  return server.registerTool(
    'list_projects',
    {
      title: 'List Projects',
      description:
        'List projects tracked by Barnacles, optionally filtered by a search term or technology slugs.',
      inputSchema: {
        search: z.string().optional().describe('Filter projects by name'),
        technologies: z
          .array(z.string())
          .optional()
          .describe('Filter projects by technology slugs (e.g. "vue", "rust")'),
      },
    },
    async ({ search, technologies }) => {
      try {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (technologies?.length) params.set('technologies', technologies.join(','));
        const query = params.toString();

        const projects = await apiClient.get<ProjectWithDetails[]>(
          `${API_ROUTES.PROJECTS}${query ? `?${query}` : ''}`
        );

        return {
          content: [{ type: 'text', text: JSON.stringify(projects, null, 2) }],
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
