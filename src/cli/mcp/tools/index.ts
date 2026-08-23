import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
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
import { registerConvertColorTool } from './convert-color.js';
import { registerGenerateColorShadesTool } from './generate-color-shades.js';
import { registerReadExifDataTool } from './read-exif-data.js';
import { registerStripExifDataTool } from './strip-exif-data.js';

/**
 * Register every Barnacles MCP tool on the server.
 *
 * Returns the registered tools keyed by name so callers can instrument them
 * (see `instrumentServer`) and so the catalog parity test can assert that
 * `MCP_TOOLS` matches what is actually registered.
 */
export function registerTools(server: McpServer): Record<string, RegisteredTool> {
  // Keys are the MCP tool names as registered; `RegisteredTool` itself does not
  // carry its name, so they are spelled out here.
  return {
    list_projects: registerListProjectsTool(server),
    get_project_by_path: registerGetProjectByPathTool(server),
    get_project_status: registerGetProjectStatusTool(server),
    list_ports: registerListPortsTool(server),
    kill_port_process: registerKillPortProcessTool(server),
    start_project_process: registerStartProjectProcessTool(server),
    stop_project_process: registerStopProjectProcessTool(server),
    get_project_readme: registerGetProjectReadmeTool(server),
    get_hosts_entries: registerGetHostsEntriesTool(server),
    list_running_processes: registerListRunningProcessesTool(server),
    get_process_output: registerGetProcessOutputTool(server),
    get_project_scripts: registerGetProjectScriptsTool(server),
    list_project_accounts: registerListProjectAccountsTool(server),
    open_project_accounts: registerOpenProjectAccountsTool(server),
    upsert_project_process: registerUpsertProjectProcessTool(server),
    remove_project_process: registerRemoveProjectProcessTool(server),
    convert_color: registerConvertColorTool(server),
    generate_color_shades: registerGenerateColorShadesTool(server),
    read_exif_data: registerReadExifDataTool(server),
    strip_exif_data: registerStripExifDataTool(server),
  };
}
