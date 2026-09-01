/**
 * Static catalog of every tool exposed by the Barnacles MCP server.
 *
 * Lives in `src/shared` because the backend and frontend cannot import the CLI
 * (they are separately bundled), so the MCP registry in `src/cli/mcp/tools/`
 * is not reachable from the app. The frontend imports this directly — usage
 * counts come from the API and are joined by `name`.
 *
 * Kept honest by `src/cli/__tests__/mcp/tool-catalog-parity.test.ts`, which
 * fails if this drifts from the actual registrations.
 */

export type McpToolCategory = 'projects' | 'processes' | 'ports' | 'system' | 'utilities';

export interface McpToolInput {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface McpToolInfo {
  name: string;
  title: string;
  description: string;
  category: McpToolCategory;
  inputs: McpToolInput[];
  /** Irreversible side effects — surfaced with a warning badge in the UI. */
  destructive?: boolean;
}

/** Display order and labels for grouping the catalog in the UI. */
export const MCP_TOOL_CATEGORIES: { value: McpToolCategory; label: string }[] = [
  { value: 'projects', label: 'Projects' },
  { value: 'processes', label: 'Processes' },
  { value: 'ports', label: 'Ports' },
  { value: 'system', label: 'System' },
  { value: 'utilities', label: 'Utilities' },
];

export const MCP_TOOLS: McpToolInfo[] = [
  {
    name: 'list_projects',
    title: 'List Projects',
    description:
      "List the projects tracked by Barnacles — use when a question refers to the user's projects, repos, or codebases in general rather than one known directory. Optionally filtered by a search term or technology slugs. Prefer get_project_by_path when the directory is already known.",
    category: 'projects',
    inputs: [
      {
        name: 'search',
        type: 'string',
        required: false,
        description: 'Filter projects by name',
      },
      {
        name: 'technologies',
        type: 'array',
        required: false,
        description: 'Filter projects by technology slugs (e.g. "vue", "rust")',
      },
    ],
  },
  {
    name: 'get_project_by_path',
    title: 'Get Project By Path',
    description:
      'Resolve a filesystem path (e.g. the current working directory) to the Barnacles project that contains it. Use this instead of list_projects when you already know the path you are working in — it is much cheaper and avoids scanning every tracked project.',
    category: 'projects',
    inputs: [
      {
        name: 'path',
        type: 'string',
        required: true,
        description: 'Absolute filesystem path to resolve, e.g. the current working directory',
      },
    ],
  },
  {
    name: 'get_project_status',
    title: 'Get Project Status',
    description:
      'Get the status of a single Barnacles project by ID: its git worktrees (each with branch, uncommitted changes and last commit), the git remote, and file stats. A project with multiple worktrees is one repository checked out in several places. Use get_project_by_path if you know the project directory, or list_projects otherwise, to find the project ID.',
    category: 'projects',
    inputs: [
      {
        name: 'projectId',
        type: 'string',
        required: true,
        description: 'The ID of the project to look up',
      },
    ],
  },
  {
    name: 'list_ports',
    title: 'List Ports',
    description:
      'List TCP ports currently in LISTEN state on the local machine — use when a port is unexpectedly occupied, a dev server will not bind, or something needs to be identified by the port it is holding. Includes PID, process name, and start time.',
    category: 'ports',
    inputs: [],
  },
  {
    name: 'kill_port_process',
    title: 'Kill Port Process',
    description:
      'Kill the process holding a given PID (e.g. to free up a port). Use list_ports first to find the PID. This is irreversible.',
    category: 'ports',
    destructive: true,
    inputs: [
      {
        name: 'pid',
        type: 'number',
        required: true,
        description: 'The process ID to kill',
      },
    ],
  },
  {
    name: 'start_project_process',
    title: 'Start Project Process',
    description:
      "Start all of a project's configured dev processes (the same processes started by the 'Start Processes' action in the app). Use get_project_by_path if you know the project directory, or list_projects otherwise, to find the project ID.",
    category: 'processes',
    inputs: [
      {
        name: 'projectId',
        type: 'string',
        required: true,
        description: 'The ID of the project to start processes for',
      },
    ],
  },
  {
    name: 'stop_project_process',
    title: 'Stop Project Process',
    description:
      "Stop all of a project's running dev processes (the same processes stopped by the 'Stop Processes' action in the app). Use get_project_by_path if you know the project directory, or list_projects otherwise, to find the project ID.",
    category: 'processes',
    inputs: [
      {
        name: 'projectId',
        type: 'string',
        required: true,
        description: 'The ID of the project to stop processes for',
      },
    ],
  },
  {
    name: 'get_project_readme',
    title: 'Get Project Readme',
    description:
      'Get the README.md content for a project. Use get_project_by_path if you know the project directory, or list_projects otherwise, to find the project ID.',
    category: 'projects',
    inputs: [
      {
        name: 'projectId',
        type: 'string',
        required: true,
        description: 'The ID of the project to read the README for',
      },
    ],
  },
  {
    name: 'get_hosts_entries',
    title: 'Get Hosts Entries',
    description:
      'List local domain overrides from the system hosts file — use when a .local/.test domain needs checking, or when diagnosing why a hostname resolves unexpectedly.',
    category: 'system',
    inputs: [],
  },
  {
    name: 'list_running_processes',
    title: 'List Running Processes',
    description:
      'List the status of dev processes across all projects, running, stopped, or failed — use when checking whether a dev server or watcher is already up, or finding which processes belong to a project.',
    category: 'processes',
    inputs: [],
  },
  {
    name: 'get_process_output',
    title: 'Get Process Output',
    description:
      'Get the recent output (stdout/stderr) of a running or stopped dev process. Use list_running_processes first to find the process ID. Defaults to the last 200 lines; pass lines to change how many.',
    category: 'processes',
    inputs: [
      {
        name: 'processId',
        type: 'string',
        required: true,
        description: 'The ID of the process to get output for',
      },
      {
        name: 'lines',
        type: 'number',
        required: false,
        description: 'Number of most recent output lines to return (default 200)',
      },
    ],
  },
  {
    name: 'get_project_scripts',
    title: 'Get Project Scripts',
    description:
      "Get a project's available run scripts: package.json scripts, composer.json scripts, and the detected package manager (npm, yarn, or pnpm). Use get_project_by_path if you know the project directory, or list_projects otherwise, to find the project ID.",
    category: 'projects',
    inputs: [
      {
        name: 'projectId',
        type: 'string',
        required: true,
        description: 'The ID of the project to look up scripts for',
      },
    ],
  },
  {
    name: 'list_project_accounts',
    title: 'List Project Accounts',
    description:
      'List the accounts (logins) stored for a project, e.g. hosting or service credentials. Passwords are never included — use open_project_accounts to view a password in the app. Use get_project_by_path if you know the project directory, or list_projects otherwise, to find the project ID.',
    category: 'projects',
    inputs: [
      {
        name: 'projectId',
        type: 'string',
        required: true,
        description: 'The ID of the project to list accounts for',
      },
    ],
  },
  {
    name: 'open_project_accounts',
    title: 'Open Project Accounts',
    description:
      "Focus the Barnacles app window and navigate it to a project's Accounts tab, so the user can view a password themselves. Passwords are never returned to the assistant. Use get_project_by_path if you know the project directory, or list_projects otherwise, to find the project ID.",
    category: 'projects',
    inputs: [
      {
        name: 'projectId',
        type: 'string',
        required: true,
        description: 'The ID of the project to open the Accounts tab for',
      },
    ],
  },
  {
    name: 'upsert_project_process',
    title: 'Upsert Project Process',
    description:
      'Create a new start process for a project, or edit an existing one. Pass processId (from the data returned by this tool, or from list_running_processes) to edit that process in place; omit processId to create a new one. Use get_project_by_path if you know the project directory, or list_projects otherwise, to find the project ID, and get_project_scripts to find available commands.',
    category: 'processes',
    inputs: [
      {
        name: 'projectId',
        type: 'string',
        required: true,
        description: 'The ID of the project to configure',
      },
      {
        name: 'processId',
        type: 'string',
        required: false,
        description: 'ID of an existing process to edit; omit to create a new process',
      },
      {
        name: 'name',
        type: 'string',
        required: true,
        description: 'Display name for the process',
      },
      {
        name: 'commands',
        type: 'array',
        required: true,
        description: 'Shell commands to run in sequence (joined with &&)',
      },
      {
        name: 'workingDir',
        type: 'string',
        required: false,
        description: 'Working directory relative to the project root',
      },
      {
        name: 'color',
        type: 'string',
        required: false,
        description: 'Hex color for display in the app',
      },
      {
        name: 'url',
        type: 'string',
        required: false,
        description: 'URL where the running process will be accessible',
      },
    ],
  },
  {
    name: 'remove_project_process',
    title: 'Remove Project Process',
    description:
      "Remove a configured start process from a project. Use get_project_status or upsert_project_process to find a process's ID.",
    category: 'processes',
    destructive: true,
    inputs: [
      {
        name: 'projectId',
        type: 'string',
        required: true,
        description: 'The ID of the project',
      },
      {
        name: 'processId',
        type: 'string',
        required: true,
        description: 'ID of the process to remove',
      },
    ],
  },
  {
    name: 'convert_color',
    title: 'Convert Color',
    description:
      'Convert a CSS color between formats — use whenever a color needs to be expressed in a different notation than it is currently written in. Accepts hex, rgb, hsl, or named colors and returns hex, rgb, rgba, hsl, hsla, lch, and oklch.',
    category: 'utilities',
    inputs: [
      {
        name: 'color',
        type: 'string',
        required: true,
        description:
          'The color to convert, in any CSS format (e.g. "#3b82f6", "rgb(59, 130, 246)", "royalblue")',
      },
      {
        name: 'alpha',
        type: 'number',
        required: false,
        description: 'Alpha/opacity value from 0 to 1 (default: 1)',
      },
    ],
  },
  {
    name: 'generate_color_shades',
    title: 'Generate Color Shades',
    description:
      'Generate a full color palette from a single base color — use when creating or extending theme colors, brand colors, a design system, or a Tailwind color config instead of hand-picking hex values. Produces perceptually-uniform shades via OKLCH with WCAG contrast ratings per shade, exportable as CSS variables, Tailwind 3/4 config, or SCSS.',
    category: 'utilities',
    inputs: [
      {
        name: 'baseColor',
        type: 'string',
        required: true,
        description: 'Base color in any CSS format (e.g. "#3b82f6")',
      },
      {
        name: 'count',
        type: 'number',
        required: false,
        description: 'Number of shades to generate (default: 11)',
      },
      {
        name: 'algorithm',
        type: 'enum(tailwind|vibrant|natural)',
        required: false,
        description: 'Shade generation algorithm preset (default: tailwind)',
      },
      {
        name: 'exportFormat',
        type: 'enum(css|tailwind3|tailwind4|scss|json)',
        required: false,
        description: 'If provided, also include the palette serialized in this format',
      },
      {
        name: 'colorName',
        type: 'string',
        required: false,
        description: 'Name to use for the color in the export output (default: "primary")',
      },
    ],
  },
  {
    name: 'read_exif_data',
    title: 'Read EXIF Data',
    description:
      "Inspect an image's embedded metadata — use when checking what camera, timestamp, or GPS location an image file carries, such as before publishing or sharing it. Reads EXIF, IPTC, and XMP data.",
    category: 'utilities',
    inputs: [
      {
        name: 'imagePath',
        type: 'string',
        required: true,
        description: 'Absolute or relative path to the image file',
      },
    ],
  },
  {
    name: 'strip_exif_data',
    title: 'Strip EXIF Data',
    description:
      'Remove EXIF metadata, including GPS coordinates, from a JPEG — use when preparing an image for publication or sharing and its embedded location or camera data should not travel with it. Writes to a new file; the original is never modified. JPEG/JPG only.',
    category: 'utilities',
    destructive: true,
    inputs: [
      {
        name: 'imagePath',
        type: 'string',
        required: true,
        description: 'Path to the source JPEG image',
      },
      {
        name: 'outputPath',
        type: 'string',
        required: true,
        description: 'Path to write the stripped image to (must differ from imagePath)',
      },
    ],
  },
];

/** Look up a tool's catalog entry by its MCP name. */
export function getMcpTool(name: string): McpToolInfo | undefined {
  return MCP_TOOLS.find(tool => tool.name === name);
}
