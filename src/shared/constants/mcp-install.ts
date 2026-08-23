/**
 * Install and configuration snippets for the Barnacles MCP server.
 *
 * Extracted from the Settings component so the MCP page and Settings render the
 * same content from one source rather than maintaining two copies.
 */

export interface McpJsonConfigClient {
  value: string;
  label: string;
  /** Where the snippet goes. */
  path: string;
  /** What the user must do for the client to pick it up. */
  reload: string;
}

/** One-liner for Claude Code — no config file editing needed. */
export const MCP_CLAUDE_CODE_COMMAND = 'claude mcp add --scope user barnacles -- barnacles mcp';

/** Clients that share the standard `mcpServers` JSON shape. */
export const MCP_JSON_CONFIG_CLIENTS: McpJsonConfigClient[] = [
  {
    value: 'claude-desktop',
    label: 'Claude Desktop',
    path: 'claude_desktop_config.json',
    reload: 'restart Claude Desktop',
  },
  {
    value: 'cursor',
    label: 'Cursor',
    path: '.cursor/mcp.json (project) or ~/.cursor/mcp.json (global)',
    reload: 'reload Cursor',
  },
  {
    value: 'gemini-cli',
    label: 'Gemini CLI',
    path: '.gemini/settings.json (project) or ~/.gemini/settings.json (global)',
    reload: 'restart Gemini CLI',
  },
  {
    value: 'vscode',
    label: 'VS Code',
    path: '.vscode/mcp.json',
    reload: 'reload the VS Code window',
  },
  {
    value: 'windsurf',
    label: 'Windsurf',
    path: '~/.codeium/windsurf/mcp_config.json',
    reload: 'restart Windsurf',
  },
];

export const MCP_JSON_CONFIG_SNIPPET = JSON.stringify(
  {
    mcpServers: {
      barnacles: {
        command: 'barnacles',
        args: ['mcp'],
      },
    },
  },
  null,
  2
);

export const MCP_OPENCODE_CONFIG_SNIPPET = JSON.stringify(
  {
    mcp: {
      barnacles: {
        type: 'local',
        command: ['barnacles', 'mcp'],
        enabled: true,
      },
    },
  },
  null,
  2
);

/** Paste-in block for CLAUDE.md / AGENTS.md so agents know when to reach for these tools. */
export const MCP_AGENT_INSTRUCTIONS = `## Barnacles MCP

This project is managed by Barnacles. Prefer the \`barnacles\` MCP tools over ad-hoc shell commands for the following:

- Starting or stopping the dev server(s) — use \`start_project_process\` / \`stop_project_process\` instead of running \`npm run dev\` directly, so the process is tracked and visible in the Barnacles UI.
- Reading dev server logs — use \`get_process_output\` instead of re-running the command or tailing a log file.
- Checking what's already running — use \`list_running_processes\` before starting a process, to avoid spawning duplicates.
- Checking port usage — use \`list_ports\` to see what's listening, and \`kill_port_process\` to free a port (irreversible, only do this when asked).
- Looking up project info — use \`list_projects\`, \`get_project_status\`, \`get_project_readme\`, and \`get_project_scripts\` instead of guessing paths or re-reading files already indexed by Barnacles.
- Checking local domain overrides — use \`get_hosts_entries\` instead of reading /etc/hosts directly.
- Project credentials — use \`list_project_accounts\` to see what accounts exist (passwords are never exposed); use \`open_project_accounts\` to have the user view a password themselves in the app.

Always call \`list_projects\` first if you don't already know the project ID.`;
