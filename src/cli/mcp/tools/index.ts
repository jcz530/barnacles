import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerListProjectsTool } from './list-projects.js';
import { registerGetProjectStatusTool } from './get-project-status.js';
import { registerListPortsTool } from './list-ports.js';
import { registerKillPortProcessTool } from './kill-port-process.js';
import { registerStartProjectProcessTool } from './start-project-process.js';
import { registerStopProjectProcessTool } from './stop-project-process.js';
import { registerGetProjectReadmeTool } from './get-project-readme.js';
import { registerGetHostsEntriesTool } from './get-hosts-entries.js';
import { registerListRunningProcessesTool } from './list-running-processes.js';

export function registerTools(server: McpServer): void {
  registerListProjectsTool(server);
  registerGetProjectStatusTool(server);
  registerListPortsTool(server);
  registerKillPortProcessTool(server);
  registerStartProjectProcessTool(server);
  registerStopProjectProcessTool(server);
  registerGetProjectReadmeTool(server);
  registerGetHostsEntriesTool(server);
  registerListRunningProcessesTool(server);
}
