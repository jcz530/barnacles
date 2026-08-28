import os from 'os';
import path from 'path';
import type { IPty } from 'node-pty';
import * as pty from 'node-pty';
import type { ProcessStatus, ProjectProcessStatus, StartProcess } from '../../shared/types/process';
import { isWindows, getDefaultShell } from '../../shared/utils/platform';
import { isDemoMode } from '../../shared/config/runtime-mode';

/**
 * How many PTY output chunks to retain per process. The unit is chunks, not
 * lines: one chunk may carry many lines or part of one.
 */
const MAX_OUTPUT_CHUNKS = 1000;

export interface RunningProcess {
  name: string;
  bashId: string;
  process: IPty;
  status: 'running' | 'stopped' | 'failed';
  exitCode?: number;
  error?: string;
  output: string[]; // Store output lines
  configuredUrl?: string; // URL from configuration
  detectedUrl?: string; // URL detected from output
  title?: string; // Title for ad-hoc processes
  cwd?: string; // Working directory for ad-hoc processes
  command?: string; // Original command for ad-hoc processes
  createdAt: Date; // Creation timestamp
}

export class ProcessManagerService {
  // Map of projectId -> Map of processId -> RunningProcess
  private runningProcesses: Map<string, Map<string, RunningProcess>> = new Map();

  /** Populated only in demo mode, by loadDemoProcesses(). */
  private demoProcesses: ProjectProcessStatus[] = [];

  /**
   * Load the mocked demo processes.
   *
   * Called from server startup behind an isDemoMode() check. The dynamic import
   * keeps the fixtures in their own chunk instead of the main bundle that every
   * packaged build loads.
   */
  async loadDemoProcesses(): Promise<void> {
    const { getDemoRunningProcesses } =
      await import('../../shared/database/demo/data/running-processes');
    this.demoProcesses = getDemoRunningProcesses();
  }

  /**
   * Spawn a process with properly configured environment
   * This ensures consistent environment setup across all process spawning
   */
  private spawnProcessWithEnvironment(command: string | undefined, cwd: string): IPty {
    // Build environment with all parent env vars plus our overrides
    const envVars = {
      ...process.env,
      TERM: 'xterm-256color',
      FORCE_COLOR: '1',
    } as Record<string, string>;

    // Ensure critical environment variables are set
    if (!envVars.HOME && !isWindows) {
      envVars.HOME = process.env.HOME || os.homedir();
    }
    if (!envVars.USER && !isWindows) {
      envVars.USER = process.env.USER || os.userInfo().username;
    }

    const shell = getDefaultShell();

    // Start the process using node-pty for proper terminal emulation
    let args: string[];

    if (isWindows) {
      // Windows: Use cmd.exe or powershell with /c or -Command flag
      if (shell.includes('powershell')) {
        args = command ? ['-NoLogo', '-Command', command] : ['-NoLogo'];
      } else {
        // cmd.exe
        args = command ? ['/c', command] : [];
      }
    } else {
      // Unix: Use login shell (-l) to load user's PATH (npm, node, etc.)
      // If command is provided, execute it; otherwise start an interactive shell
      envVars.SHELL = shell;
      args = command ? ['-l', '-c', command] : ['-l'];
    }

    return pty.spawn(shell, args, {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd,
      env: envVars,
    });
  }

  /**
   * Wire output buffering, URL detection, and exit handling onto a freshly
   * spawned process. Shared by both spawn paths so the ring buffer and exit
   * bookkeeping can only ever be defined once.
   */
  private attachProcessHandlers(runningProcess: RunningProcess): void {
    const ptyProcess = runningProcess.process;

    // Capture all output (stdout and stderr combined in PTY)
    ptyProcess.onData((data: string) => {
      runningProcess.output.push(data);

      // Keep only the last 1000 chunks to prevent unbounded memory growth.
      // Note: the unit is PTY chunks, not lines -- a chunk may hold many lines
      // or a partial one.
      if (runningProcess.output.length > MAX_OUTPUT_CHUNKS) {
        runningProcess.output = runningProcess.output.slice(-MAX_OUTPUT_CHUNKS);
      }

      // A configured URL is the user's explicit choice, so only fall back to
      // sniffing one out of the output when they haven't set one.
      if (!runningProcess.detectedUrl && !runningProcess.configuredUrl) {
        const detectedUrl = this.detectUrl(data);
        if (detectedUrl) {
          runningProcess.detectedUrl = detectedUrl;
          console.log(`Detected URL for process ${runningProcess.name}: ${detectedUrl}`);
        }
      }
    });

    // Handle process exit
    ptyProcess.onExit(({ exitCode }) => {
      runningProcess.status = exitCode === 0 ? 'stopped' : 'failed';
      runningProcess.exitCode = exitCode;
    });
  }

  /**
   * Detect URLs from process output
   */
  private detectUrl(output: string): string | undefined {
    // First, strip all ANSI escape codes from the entire output
    // eslint-disable-next-line no-control-regex -- \x1B matches the ANSI escape character
    const cleanOutput = output.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');

    // Common URL patterns in development server output
    const patterns = [
      // Vite/Next.js style: "Local: http://localhost:3000" or "➜ Local: http://localhost:3000"
      /(?:➜\s*)?Local:\s+(https?:\/\/[^\s,)]+)/i,
      // Network: pattern
      /(?:➜\s*)?Network:\s+(https?:\/\/[^\s,)]+)/i,
      // Various frameworks: "Running on http://localhost:8000"
      /(?:Running|Listening|Server|App|started)\s+(?:on|at)[\s:]+?(https?:\/\/[^\s,)]+)/i,
      // "Listening at http://localhost:3000"
      /(?:Listening|Available)\s+at\s+(https?:\/\/[^\s,)]+)/i,
      // Standard HTTP/HTTPS URLs with required port
      /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+(?:\/[^\s,)]*)?/i,
      // Generic with optional port (fallback)
      /(?:^|\s)(https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?)/i,
    ];

    for (const pattern of patterns) {
      const match = cleanOutput.match(pattern);
      if (match) {
        // Get the captured URL (either full match or first capture group)
        let url = match[1] || match[0];
        // Clean up the URL - remove trailing punctuation
        url = url.trim().replace(/[,;.)\]]+$/, '');

        // Ensure we have a valid URL with protocol
        if (url.startsWith('http://') || url.startsWith('https://')) {
          console.log(
            `[URL Detection] Detected URL: ${url} from output: ${cleanOutput.substring(0, 150)}`
          );
          return url;
        }
      }
    }

    return undefined;
  }

  /**
   * Start all configured processes for a project
   */
  async startProjectProcesses(
    projectId: string,
    projectPath: string,
    processes: StartProcess[]
  ): Promise<ProjectProcessStatus> {
    // Initialize project map if it doesn't exist
    if (!this.runningProcesses.has(projectId)) {
      this.runningProcesses.set(projectId, new Map());
    }

    const projectProcesses = this.runningProcesses.get(projectId)!;
    const statuses: ProcessStatus[] = [];

    for (const processConfig of processes) {
      // Skip if already running
      if (projectProcesses.has(processConfig.id)) {
        const existing = projectProcesses.get(processConfig.id)!;
        statuses.push({
          processId: processConfig.id,
          projectId,
          name: existing.name,
          title: existing.title,
          cwd: existing.cwd,
          command: existing.command,
          status: existing.status,
          bashId: existing.bashId,
        });
        continue;
      }

      try {
        // Join commands with && to stop on first failure
        const commandString = processConfig.commands.join(' && ');

        // Determine working directory (use path.join for cross-platform compatibility)
        const cwd = processConfig.workingDir
          ? path.join(projectPath, processConfig.workingDir)
          : projectPath;

        console.log('[Process Start] Starting process:', {
          processName: processConfig.name,
          command: commandString,
          cwd,
        });

        // Use unified spawning method to ensure consistent environment setup
        const ptyProcess = this.spawnProcessWithEnvironment(commandString, cwd);

        // Generate a bash ID (simulating background bash sessions)
        const bashId = `${projectId}-${processConfig.id}-${Date.now()}`;

        const runningProcess: RunningProcess = {
          name: processConfig.name,
          bashId,
          process: ptyProcess,
          status: 'running',
          output: [],
          configuredUrl: processConfig.url,
          createdAt: new Date(),
        };

        this.attachProcessHandlers(runningProcess);

        projectProcesses.set(processConfig.id, runningProcess);

        statuses.push({
          processId: processConfig.id,
          projectId,
          name: processConfig.name,
          status: 'running',
          bashId,
          createdAt: runningProcess.createdAt.toISOString(),
        });
      } catch (error) {
        console.error('[Process Start] Failed to start process:', {
          processId: processConfig.id,
          processName: processConfig.name,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        statuses.push({
          processId: processConfig.id,
          projectId,
          name: processConfig.name,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      projectId,
      processes: statuses,
    };
  }

  /**
   * Stop all running processes for a project
   */
  async stopProjectProcesses(projectId: string): Promise<void> {
    const projectProcesses = this.runningProcesses.get(projectId);

    if (!projectProcesses) {
      return;
    }

    // Kill all processes
    for (const [processId, runningProcess] of projectProcesses.entries()) {
      try {
        runningProcess.process.kill();
        runningProcess.status = 'stopped';
      } catch (error) {
        console.error(`Failed to kill process ${processId}:`, error);
      }
    }

    // Clear the project's processes
    this.runningProcesses.delete(projectId);
  }

  /**
   * Stop a specific process for a project
   */
  async stopProcess(projectId: string, processId: string): Promise<void> {
    const projectProcesses = this.runningProcesses.get(projectId);

    if (!projectProcesses || !projectProcesses.has(processId)) {
      return;
    }

    const runningProcess = projectProcesses.get(processId)!;

    try {
      runningProcess.process.kill();
      runningProcess.status = 'stopped';
    } catch (error) {
      console.error(`Failed to kill process ${processId}:`, error);
    }

    projectProcesses.delete(processId);

    // Clean up project map if empty
    if (projectProcesses.size === 0) {
      this.runningProcesses.delete(projectId);
    }
  }

  /**
   * Get the status of all processes across all projects
   */
  getAllProcessStatuses(): ProjectProcessStatus[] {
    const allStatuses: ProjectProcessStatus[] = [];

    for (const projectId of this.runningProcesses.keys()) {
      allStatuses.push(this.getProcessStatus(projectId));
    }

    // Demo mode reports a couple of projects as live without spawning anything,
    // so the dashboard shows real localhost URLs. Anything genuinely running
    // still wins, so starting a process in demo mode behaves normally.
    const running = new Set(allStatuses.map(status => status.projectId));
    for (const mocked of this.getMockedProcesses()) {
      if (!running.has(mocked.projectId)) allStatuses.push(mocked);
    }

    return allStatuses;
  }

  /**
   * Mocked "running" processes, empty outside demo mode.
   *
   * Loaded via `loadDemoProcesses()` at startup rather than imported here, so
   * the fixtures are code-split out of the chunk every packaged build loads.
   */
  private getMockedProcesses(): ProjectProcessStatus[] {
    return isDemoMode() ? this.demoProcesses : [];
  }

  /**
   * Get the status of all processes for a project
   */
  getProcessStatus(projectId: string): ProjectProcessStatus {
    const projectProcesses = this.runningProcesses.get(projectId);

    if (!projectProcesses) {
      const mocked = this.getMockedProcesses().find(status => status.projectId === projectId);
      if (mocked) return mocked;

      return {
        projectId,
        processes: [],
      };
    }

    const statuses: ProcessStatus[] = [];

    for (const [processId, runningProcess] of projectProcesses.entries()) {
      statuses.push({
        processId,
        projectId,
        name: runningProcess.name,
        title: runningProcess.title,
        cwd: runningProcess.cwd,
        command: runningProcess.command,
        status: runningProcess.status,
        bashId: runningProcess.bashId,
        exitCode: runningProcess.exitCode,
        error: runningProcess.error,
        url: runningProcess.configuredUrl || runningProcess.detectedUrl,
        detectedUrl: runningProcess.detectedUrl,
        createdAt: runningProcess.createdAt.toISOString(),
      });
    }

    return {
      projectId,
      processes: statuses,
    };
  }

  /**
   * Get output from a specific process
   */
  getProcessOutput(projectId: string, processId: string): string[] | null {
    const projectProcesses = this.runningProcesses.get(projectId);

    if (!projectProcesses || !projectProcesses.has(processId)) {
      return null;
    }

    const runningProcess = projectProcesses.get(processId)!;
    return runningProcess.output;
  }

  /**
   * Check if any processes are running for a project
   */
  hasRunningProcesses(projectId: string): boolean {
    const projectProcesses = this.runningProcesses.get(projectId);

    if (!projectProcesses) {
      return false;
    }

    for (const runningProcess of projectProcesses.values()) {
      if (runningProcess.status === 'running') {
        return true;
      }
    }

    return false;
  }

  /**
   * Create an ad-hoc process (for running scripts)
   */
  async createProcess(params: {
    projectId?: string;
    cwd?: string;
    command?: string;
    title?: string;
  }): Promise<ProcessStatus> {
    const processId = `adhoc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const projectId = params.projectId || 'global';

    // Initialize project map if it doesn't exist
    if (!this.runningProcesses.has(projectId)) {
      this.runningProcesses.set(projectId, new Map());
    }

    const projectProcesses = this.runningProcesses.get(projectId)!;

    // Determine the command to run and working directory
    const cwd = params.cwd || process.cwd();
    const title = params.title || (params.command ? `Running: ${params.command}` : 'Process');

    // Use unified spawning method to ensure consistent environment setup
    const ptyProcess = this.spawnProcessWithEnvironment(params.command, cwd);

    const bashId = `${projectId}-${processId}-${Date.now()}`;

    const runningProcess: RunningProcess = {
      name: title,
      title,
      command: params.command,
      cwd,
      bashId,
      process: ptyProcess,
      status: 'running',
      output: [],
      createdAt: new Date(),
    };

    this.attachProcessHandlers(runningProcess);

    projectProcesses.set(processId, runningProcess);

    return {
      processId,
      projectId,
      name: title,
      title,
      cwd,
      command: params.command,
      status: 'running',
      bashId,
      createdAt: runningProcess.createdAt.toISOString(),
    };
  }

  /**
   * Get all processes (for listing all processes across projects)
   */
  getAllProcesses(): ProcessStatus[] {
    const allProcesses: ProcessStatus[] = [];

    for (const [projectId, projectProcesses] of this.runningProcesses.entries()) {
      for (const [processId, runningProcess] of projectProcesses.entries()) {
        allProcesses.push({
          processId,
          projectId,
          name: runningProcess.name,
          title: runningProcess.title,
          cwd: runningProcess.cwd,
          command: runningProcess.command,
          status: runningProcess.status,
          bashId: runningProcess.bashId,
          exitCode: runningProcess.exitCode,
          error: runningProcess.error,
          url: runningProcess.configuredUrl || runningProcess.detectedUrl,
          detectedUrl: runningProcess.detectedUrl,
          createdAt: runningProcess.createdAt.toISOString(),
        });
      }
    }

    return allProcesses;
  }

  /**
   * Locate a running process by ID across every project.
   *
   * Process IDs are only unique per project by construction (ad-hoc processes
   * live under a synthetic 'global' project), so a by-ID lookup has to scan.
   * The map holds a handful of projects, so one shared scan beats keeping a
   * second flat index in sync across every mutation site.
   */
  private findRunning(processId: string): { projectId: string; process: RunningProcess } | null {
    for (const [projectId, projectProcesses] of this.runningProcesses.entries()) {
      const process = projectProcesses.get(processId);
      if (process) {
        return { projectId, process };
      }
    }
    return null;
  }

  /**
   * Get a single process by ID across all projects
   */
  getProcess(processId: string): ProcessStatus | null {
    const found = this.findRunning(processId);
    if (!found) {
      return null;
    }

    const { projectId, process: runningProcess } = found;
    return {
      processId,
      projectId,
      name: runningProcess.name,
      title: runningProcess.title,
      cwd: runningProcess.cwd,
      command: runningProcess.command,
      status: runningProcess.status,
      bashId: runningProcess.bashId,
      exitCode: runningProcess.exitCode,
      error: runningProcess.error,
      url: runningProcess.configuredUrl || runningProcess.detectedUrl,
      detectedUrl: runningProcess.detectedUrl,
      createdAt: runningProcess.createdAt.toISOString(),
    };
  }

  /**
   * Kill a specific process by ID (search across all projects)
   */
  async killProcess(processId: string): Promise<boolean> {
    const found = this.findRunning(processId);
    if (!found) {
      return false;
    }

    const { projectId, process: runningProcess } = found;
    const projectProcesses = this.runningProcesses.get(projectId)!;

    try {
      runningProcess.process.kill();
      runningProcess.status = 'stopped';
    } catch (error) {
      console.error(`Failed to kill process ${processId}:`, error);
    }

    projectProcesses.delete(processId);

    // Clean up project map if empty
    if (projectProcesses.size === 0) {
      this.runningProcesses.delete(projectId);
    }

    return true;
  }

  /**
   * Get output from a process by ID (search across all projects)
   */
  getProcessOutputById(processId: string): string[] | null {
    return this.findRunning(processId)?.process.output ?? null;
  }

  /**
   * Clean up all processes (call on app shutdown)
   */
  async cleanup(): Promise<void> {
    for (const projectId of this.runningProcesses.keys()) {
      await this.stopProjectProcesses(projectId);
    }
  }
}

export const processManagerService = new ProcessManagerService();
