export interface StartProcess {
  id: string;
  name: string;
  commands: string[];
  workingDir?: string; // relative to project root
  color?: string;
  url?: string; // optional URL where the process will be accessible
}

export interface DetectedScriptGroup {
  relativeDir: string; // '' for project root, e.g. 'backend' for a subdirectory
  scripts: Record<string, string>;
}

/**
 * A script from a project's package.json or composer.json, with the command
 * needed to run it already worked out.
 *
 * The command is assembled on the server because choosing between npm, yarn and
 * pnpm is a per-directory question -- a monorepo root and one of its workspaces
 * can disagree -- and resolving it in the client means one request per
 * subdirectory, with the wrong command shown until each reply lands.
 */
export interface RunnableScript {
  /** Which manifest it came from. */
  source: 'npm' | 'composer';
  /** '' for the project root, e.g. 'backend' for a subdirectory. */
  relativeDir: string;
  name: string;
  /** The script body, as written in the manifest. */
  script: string;
  /** Ready to run: 'pnpm build', 'npm run dev', 'composer run-script test'. */
  command: string;
  /**
   * The manifest this came from, as a person would name it: 'NPM', 'PNPM',
   * 'Composer', or 'api/package.json' for a workspace. Built here because it
   * depends on the package manager detected for that directory.
   */
  manifest: string;
}

export interface ProcessStatus {
  processId: string;
  projectId?: string; // Project ID this process belongs to
  name?: string; // Process name from StartProcess
  title?: string; // Title for ad-hoc processes
  cwd?: string; // Working directory for ad-hoc processes
  command?: string; // Original command for ad-hoc processes
  status: 'running' | 'stopped' | 'failed';
  bashId?: string; // ID of the background bash session
  exitCode?: number;
  error?: string;
  url?: string; // detected or configured URL
  detectedUrl?: string; // URL detected from stdout
  createdAt?: string; // ISO timestamp when the process was started
}

export interface ProjectProcessStatus {
  projectId: string;
  processes: ProcessStatus[];
}
