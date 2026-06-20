import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerListProjectsTool } from './list-projects.js';
import { registerGetProjectStatusTool } from './get-project-status.js';

export function registerTools(server: McpServer): void {
  registerListProjectsTool(server);
  registerGetProjectStatusTool(server);
}
