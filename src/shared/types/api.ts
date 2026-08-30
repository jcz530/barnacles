export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Technology {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  color?: string | null;
}

export interface ProjectStats {
  id: string;
  projectId: string;
  fileCount?: number | null;
  directoryCount?: number | null;
  languageStats?: Record<string, { fileCount: number; percentage: number; linesOfCode: number }>;
  linesOfCode?: number | null;
  thirdPartySize?: number | null;
  gitBranch?: string | null;
  gitStatus?: string | null;
  gitRemoteUrl?: string | null;
  lastCommitDate?: Date | null;
  lastCommitMessage?: string | null;
  hasUncommittedChanges?: boolean | null;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  description?: string | null;
  icon?: string | null;
  lastModified?: Date | null;
  size?: number | null;
  isFavorite: boolean;
  archivedAt?: Date | null;
  preferredIde?: string | null;
  preferredTerminal?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDE {
  id: string;
  name: string;
  executable: string;
  command: string;
  icon?: string;
  color?: string;
}

export interface DetectedIDE extends IDE {
  installed: boolean;
  version?: string;
}

export interface Terminal {
  id: string;
  name: string;
  executable: string;
  command: string;
  icon?: string;
  color?: string;
}

export interface DetectedTerminal extends Terminal {
  installed: boolean;
  version?: string;
}

export interface TerminalInstance {
  id: string;
  title: string;
  cwd: string;
  projectId?: string;
  command?: string;
  createdAt: Date;
  status: 'running' | 'exited';
  exitCode?: number;
}

export interface Account {
  id: number;
  projectId: string;
  name?: string | null;
  username?: string | null;
  email?: string | null;
  password?: string | null; // Decrypted password from API
  notes?: string | null;
  loginUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAccountInput {
  name?: string;
  username?: string;
  email?: string;
  password?: string;
  notes?: string;
  loginUrl?: string;
}

export interface UpdateAccountInput {
  name?: string;
  username?: string;
  email?: string;
  password?: string;
  notes?: string;
  loginUrl?: string;
}

/** A git checkout of a project: the main worktree, or a linked one. */
export interface Worktree {
  id: string;
  projectId: string;
  path: string;
  /** Null for a detached HEAD, which is not on a branch. */
  branch?: string | null;
  isMain: boolean;
  gitDir?: string | null;
  hasUncommittedChanges?: boolean | null;
  lastCommitDate?: Date | null;
  lastCommitMessage?: string | null;
  preferredIde?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectWithDetails extends Project {
  technologies: Technology[];
  stats?: ProjectStats | null;
  /** Main checkout first. Empty for a project that is not a git repository. */
  worktrees?: Worktree[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ApiResponse<T = any> {
  // Generic type with flexible default
  data?: T;
  error?: string;
  message?: string;
}

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface Setting {
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  updatedAt: Date;
}

export const SETTING_KEYS = {
  DEFAULT_IDE: 'defaultIde',
  DEFAULT_TERMINAL: 'defaultTerminal',
  GIT_EMAILS: 'gitEmails',
  INSTALL_CLI_COMMAND: 'installCliCommand',
  MCP_SERVER: 'mcpServer',
  MCP_USAGE_LOGGING: 'mcpUsageLogging',
  MCP_USAGE_RETENTION_DAYS: 'mcpUsageRetentionDays',
  SCAN_EXCLUDED_DIRECTORIES: 'scanExcludedDirectories',
  SCAN_INCLUDED_DIRECTORIES: 'scanIncludedDirectories',
  SCAN_MAX_DEPTH: 'scanMaxDepth',
  SHOW_DASHBOARD_STATS: 'showDashboardStats',
  SHOW_TRAY_ICON: 'showTrayIcon',
  THEMES: 'themes',
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

export interface Alias {
  id: string;
  name: string;
  command: string;
  description?: string | null;
  color?: string | null;
  showCommand: boolean;
  category: 'git' | 'docker' | 'system' | 'custom';
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AliasTheme {
  id: string;
  name: string;
  isActive: boolean;
  gitColor: string;
  dockerColor: string;
  systemColor: string;
  customColor: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShellInfo {
  shell: 'bash' | 'zsh' | 'fish' | 'unknown';
  profilePaths: string[];
  configPath: string; // ~/.config/barnacles/aliases
}

/**
 * Response shape of GET /api/aliases/config-path, which renames
 * ShellInfo's `configPath` to `path`.
 */
export interface AliasesConfigPath {
  shell: ShellInfo['shell'];
  profilePaths: string[];
  path: string;
}

export interface DetectedAlias {
  name: string;
  command: string;
  sourcePath: string; // which file it was found in
  lineNumber: number;
  hasConflict: boolean; // conflicts with existing alias in DB
}

export interface PresetPack {
  id: string;
  name: string;
  description: string;
  category: 'git' | 'docker' | 'system';
  icon?: string;
  aliases: Array<{
    name: string;
    command: string;
    description: string;
  }>;
}

export interface GitStatsByDay {
  date: string; // YYYY-MM-DD format
  commits: number;
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  projectsWorkedOn: number;
}

export interface GitStatsTotals {
  commits: number;
  /**
   * Distinct files touched across the whole period. Not the sum of the per-day
   * `filesChanged` values — a file edited on several days counts once here.
   */
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
  projectsWorkedOn: number;
  /** linesAdded - linesRemoved. */
  netLines: number;
  /** linesAdded + linesRemoved. */
  churn: number;
  /** Days in the range with at least one commit. */
  activeDays: number;
}

export interface GitStatsTopFile {
  /** Path relative to its repository. */
  path: string;
  /** Which repo the file belongs to; omitted when a single project is selected. */
  projectPath?: string;
  /** linesAdded + linesRemoved, the sort key. */
  changes: number;
  linesAdded: number;
  linesRemoved: number;
  commits: number;
}

export interface GitStatsLanguageSlice {
  /** Technology detector slug, e.g. 'typescript'. */
  slug: string;
  /** Display name, resolved server-side so aggregate views need no lookup. */
  label: string;
  /** Brand color from the technology detector, absent for the 'other' bucket. */
  color?: string;
  linesChanged: number;
  filesChanged: number;
  /** Share of linesChanged, 0-100. */
  percentage: number;
}

export interface GitStatsPerProject {
  projectPath: string;
  commits: number;
  filesChanged: number;
  linesAdded: number;
  linesRemoved: number;
}

export interface GitStatsStreaks {
  /** Only non-zero when the range reaches today. */
  current: number;
  longest: number;
  longestStart?: string;
  longestEnd?: string;
  /** Streak is alive but today has no commits yet. */
  warning: boolean;
}

export interface GitStatsRange {
  since: string; // YYYY-MM-DD
  until: string; // YYYY-MM-DD
  month?: string; // YYYY-MM, present for month requests
  week?: string; // YYYY-Www (ISO week), present for week requests
  year?: string; // YYYY, present for year requests
}

/** The richer blocks, returned only when `detail=full` is requested. */
export interface GitStatsDetail {
  topFiles: GitStatsTopFile[];
  languages: GitStatsLanguageSlice[];
  busiestDay: { date: string; commits: number } | null;
  perProject: GitStatsPerProject[];
  streaks: GitStatsStreaks;
}

export interface GitStats {
  days: GitStatsByDay[];
  period: 'week' | 'month' | 'last-week' | 'custom-month' | 'custom-week' | 'custom-year';
  range: GitStatsRange;
  totals: GitStatsTotals;
  detail?: GitStatsDetail;
}

export interface PortEntry {
  pid: number;
  port: number;
  protocol: 'TCP';
  processName: string;
  state: 'LISTEN';
  cwd?: string;
  startedAt?: string;
  command?: string;
  scriptName?: string;
}

/**
 * Generic app usage events.
 *
 * `source`/`category`/`name` form a coarse-to-fine taxonomy so the same log can
 * serve MCP tool calls now and other app usage later. See the `events` table.
 */
export type EventSource = 'mcp' | 'cli' | 'app' | 'api';
export type EventStatus = 'success' | 'error';

export interface EventRecord {
  id: string;
  source: EventSource;
  category: string;
  name: string;
  status: EventStatus;
  durationMs?: number | null;
  errorMessage?: string | null;
  clientName?: string | null;
  clientVersion?: string | null;
  metadata?: Record<string, unknown> | null;
  occurredAt: Date;
  createdAt: Date;
}

/** A single event as submitted by a producer (e.g. the MCP server process). */
export interface EventInput {
  source: EventSource;
  category: string;
  name: string;
  status: EventStatus;
  durationMs?: number;
  errorMessage?: string;
  clientName?: string;
  clientVersion?: string;
  metadata?: Record<string, unknown>;
  occurredAt?: string; // ISO string; defaults to now when omitted
}

export interface EventListFilter {
  source?: EventSource;
  category?: string;
  name?: string;
  status?: EventStatus;
  since?: string;
  limit?: number;
  offset?: number;
}

export interface EventListResponse {
  events: EventRecord[];
  total: number;
}

/** Per-name aggregates, used to merge usage counts into the tool catalog. */
export interface EventCount {
  name: string;
  total: number;
  errors: number;
  avgDurationMs: number | null;
  lastUsedAt: Date | null;
}

/** One day bucket in a usage time series. Days with no events are zero-filled. */
export interface EventBucket {
  date: string; // YYYY-MM-DD
  total: number;
  errors: number;
  /** Mean duration of that day's calls, or null on a day with no timed calls. */
  avgDurationMs: number | null;
  /** How many distinct tools were called that day. */
  toolsUsed: number;
}
