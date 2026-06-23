import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerListProjectsTool } from './list-projects.js';
import { registerGetProjectByPathTool } from './get-project-by-path.js';
import { registerGetProjectStatusTool } from './get-project-status.js';
import { registerListPortsTool } from './list-ports.js';
import { registerKillPortProcessTool } from './kill-port-process.js';
import { registerStartProjectProcessTool } from './start-project-process.js';
import { registerStopProjectProcessTool } from './stop-project-process.js';
import { registerGetProjectReadmeTool } from './get-project-readme.js';
import { registerGetHostsEntriesTool } from './get-hosts-entries.js';
import { registerListRunningProcessesTool } from './list-running-processes.js';
import { registerGetProcessOutputTool } from './get-process-output.js';
import { registerGetProjectScriptsTool } from './get-project-scripts.js';
import { registerListProjectAccountsTool } from './list-project-accounts.js';
import { registerOpenProjectAccountsTool } from './open-project-accounts.js';
import { registerUpsertProjectProcessTool } from './upsert-project-process.js';
import { registerRemoveProjectProcessTool } from './remove-project-process.js';

export function registerTools(server: McpServer): void {
  registerListProjectsTool(server);
  registerGetProjectByPathTool(server);
  registerGetProjectStatusTool(server);
  registerListPortsTool(server);
  registerKillPortProcessTool(server);
  registerStartProjectProcessTool(server);
  registerStopProjectProcessTool(server);
  registerGetProjectReadmeTool(server);
  registerGetHostsEntriesTool(server);
  registerListRunningProcessesTool(server);
  registerGetProcessOutputTool(server);
  registerGetProjectScriptsTool(server);
  registerListProjectAccountsTool(server);
  registerOpenProjectAccountsTool(server);
  registerUpsertProjectProcessTool(server);
  registerRemoveProjectProcessTool(server);
}
