import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerListProjectsTool } from './list-projects.js';
import { registerGetProjectStatusTool } from './get-project-status.js';
import { registerListPortsTool } from './list-ports.js';
import { registerKillPortProcessTool } from './kill-port-process.js';
import { registerStartProjectProcessTool } from './start-project-process.js';
import { registerStopProjectProcessTool } from './stop-project-process.js';

export function registerTools(server: McpServer): void {
  registerListProjectsTool(server);
  registerGetProjectStatusTool(server);
  registerListPortsTool(server);
  registerKillPortProcessTool(server);
  registerStartProjectProcessTool(server);
  registerStopProjectProcessTool(server);
}
