/**
 * Demo MCP tool-call events, backing the usage dashboard on the MCP page.
 *
 * Hand-authored rather than generated so screenshots stay byte-stable. Offsets
 * are relative to the seed anchor: `minutesAgo` drives the "2 minutes ago"
 * column in the activity feed, and `daysAgo` spreads calls across the 14-day
 * window so the sparklines have a shape instead of one spike.
 *
 * Shaped to show the page doing its job: a handful of tools carry most of the
 * traffic, a few have never been called, two clients appear, and a couple of
 * calls failed — a dashboard where everything is green and evenly used looks
 * staged.
 */

export interface DemoMcpEvent {
  /** Tool name; must match an entry in shared/constants/mcp-tools.ts. */
  name: string;
  status: 'success' | 'error';
  durationMs: number;
  clientName: string;
  clientVersion: string;
  /** Arguments as they would be recorded — already redacted, never results. */
  args?: Record<string, unknown>;
  errorMessage?: string;
  /**
   * Directory the MCP server was launched from, relative to the demo workspace
   * root. A name rather than a path, exactly like `DemoWorktree.directory`: the
   * seeder resolves it against the real demo workspace, because projects are
   * stored at their on-disk location, not their cosmetic /Users/dev path.
   *
   * May point below a project ('harbor-api/src/api') or at a directory that is
   * not a project at all, so the activity feed shows both attributed and
   * unattributed calls.
   */
  workingDir?: string;
  /** Normalized terminal id, as `detectCurrentTerminal()` would report it. */
  terminal?: string;
  daysAgo: number;
  minutesAgo: number;
}

const CLAUDE_CODE = { clientName: 'claude-code', clientVersion: '2.1.0' };
const CURSOR = { clientName: 'cursor-vscode', clientVersion: '0.42.3' };

// Origins, paired with the client that plausibly produced them: Claude Code
// runs in a terminal, Cursor is GUI-launched and so reports none. A few events
// deliberately carry no origin at all, covering servers started before this was
// recorded and exercising the unattributed fallback.
//
// Between them these cover every resolution path the UI can show: a project
// root, a subdirectory, a linked worktree, and a directory belonging to no
// project at all.
const HARBOR = { workingDir: 'harbor-api', terminal: 'ghostty' };
const HARBOR_SUBDIR = { workingDir: 'harbor-api/src/api', terminal: 'ghostty' };
const HARBOR_WORKTREE = { workingDir: 'harbor-api-billing', terminal: 'warp' };
const TIDEPOOL = { workingDir: 'tidepool', terminal: 'iterm' };
const LIGHTHOUSE = { workingDir: 'lighthouse-web' };
/** Not a tracked project — exercises the unattributed fallback in the UI. */
const SCRATCH = { workingDir: 'scratch-notes', terminal: 'terminal' };

export const DEMO_MCP_EVENTS: DemoMcpEvent[] = [
  // --- Today: a recent working session, newest first in the activity feed ---
  {
    name: 'get_process_output',
    ...CLAUDE_CODE,
    ...HARBOR,
    status: 'success',
    durationMs: 34,
    args: { processId: 'demo-proc-01', lines: 200 },
    daysAgo: 0,
    minutesAgo: 3,
  },
  {
    name: 'start_project_process',
    ...CLAUDE_CODE,
    ...HARBOR,
    status: 'success',
    durationMs: 812,
    args: { projectId: 'demo-proj-01', processId: 'demo-proc-01' },
    daysAgo: 0,
    minutesAgo: 6,
  },
  {
    name: 'list_running_processes',
    ...CLAUDE_CODE,
    ...HARBOR,
    status: 'success',
    durationMs: 12,
    args: {},
    daysAgo: 0,
    minutesAgo: 7,
  },
  {
    name: 'kill_port_process',
    ...CLAUDE_CODE,
    ...HARBOR,
    status: 'error',
    durationMs: 18,
    args: { pid: 48210 },
    errorMessage: 'Process not found',
    daysAgo: 0,
    minutesAgo: 11,
  },
  {
    name: 'list_ports',
    ...CLAUDE_CODE,
    ...HARBOR,
    status: 'success',
    durationMs: 143,
    args: {},
    daysAgo: 0,
    minutesAgo: 12,
  },
  {
    name: 'get_project_status',
    ...CLAUDE_CODE,
    ...HARBOR,
    status: 'success',
    durationMs: 67,
    args: { projectId: 'demo-proj-01' },
    daysAgo: 0,
    minutesAgo: 24,
  },
  {
    name: 'get_project_by_path',
    ...CLAUDE_CODE,
    ...HARBOR_SUBDIR,
    status: 'success',
    durationMs: 9,
    args: { path: '~/Development/aurora-api' },
    daysAgo: 0,
    minutesAgo: 25,
  },
  {
    name: 'list_projects',
    ...CLAUDE_CODE,
    ...HARBOR_SUBDIR,
    status: 'success',
    durationMs: 41,
    args: {},
    daysAgo: 0,
    minutesAgo: 26,
  },

  // --- Yesterday: a different client, showing attribution works ---
  {
    name: 'get_project_scripts',
    ...CURSOR,
    ...LIGHTHOUSE,
    status: 'success',
    durationMs: 28,
    args: { projectId: 'demo-proj-03' },
    daysAgo: 1,
    minutesAgo: 0,
  },
  {
    name: 'get_project_readme',
    ...CURSOR,
    ...LIGHTHOUSE,
    status: 'success',
    durationMs: 15,
    args: { projectId: 'demo-proj-03' },
    daysAgo: 1,
    minutesAgo: 4,
  },
  {
    name: 'list_projects',
    ...CURSOR,
    ...LIGHTHOUSE,
    status: 'success',
    durationMs: 38,
    args: { search: 'aurora' },
    daysAgo: 1,
    minutesAgo: 9,
  },
  {
    name: 'get_project_by_path',
    ...CURSOR,
    ...LIGHTHOUSE,
    status: 'error',
    durationMs: 6,
    args: { path: '~/Development/not-tracked' },
    errorMessage: 'No project found containing that path',
    daysAgo: 1,
    minutesAgo: 12,
  },
  {
    name: 'list_ports',
    ...CURSOR,
    ...LIGHTHOUSE,
    status: 'success',
    durationMs: 121,
    args: {},
    daysAgo: 1,
    minutesAgo: 18,
  },

  // --- Earlier in the window: thinner traffic, so the sparkline varies ---
  {
    name: 'list_projects',
    ...CLAUDE_CODE,
    status: 'success',
    durationMs: 44,
    args: {},
    daysAgo: 2,
    minutesAgo: 0,
  },
  {
    name: 'stop_project_process',
    ...CLAUDE_CODE,
    ...HARBOR_WORKTREE,
    status: 'success',
    durationMs: 204,
    args: { projectId: 'demo-proj-01', processId: 'demo-proc-03' },
    daysAgo: 2,
    minutesAgo: 31,
  },
  {
    name: 'get_hosts_entries',
    ...CLAUDE_CODE,
    status: 'success',
    durationMs: 8,
    args: {},
    daysAgo: 3,
    minutesAgo: 0,
  },
  {
    name: 'convert_color',
    ...CLAUDE_CODE,
    ...SCRATCH,
    status: 'success',
    durationMs: 2,
    args: { color: '#3b82f6' },
    daysAgo: 3,
    minutesAgo: 14,
  },
  {
    name: 'generate_color_shades',
    ...CLAUDE_CODE,
    ...SCRATCH,
    status: 'success',
    durationMs: 5,
    args: { baseColor: '#3b82f6', count: 11 },
    daysAgo: 3,
    minutesAgo: 16,
  },
  {
    name: 'list_projects',
    ...CLAUDE_CODE,
    status: 'success',
    durationMs: 52,
    args: {},
    daysAgo: 5,
    minutesAgo: 0,
  },
  {
    name: 'get_project_status',
    ...CLAUDE_CODE,
    ...TIDEPOOL,
    status: 'success',
    durationMs: 71,
    args: { projectId: 'demo-proj-02' },
    daysAgo: 5,
    minutesAgo: 22,
  },
  {
    name: 'list_project_accounts',
    ...CLAUDE_CODE,
    ...HARBOR,
    status: 'success',
    durationMs: 11,
    args: { projectId: 'demo-proj-01' },
    daysAgo: 6,
    minutesAgo: 0,
  },
  {
    name: 'list_ports',
    ...CLAUDE_CODE,
    status: 'success',
    durationMs: 156,
    args: {},
    daysAgo: 8,
    minutesAgo: 0,
  },
  {
    name: 'list_projects',
    ...CLAUDE_CODE,
    status: 'success',
    durationMs: 47,
    args: {},
    daysAgo: 11,
    minutesAgo: 0,
  },
];
