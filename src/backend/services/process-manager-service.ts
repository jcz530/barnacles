import type { IPty } from 'node-pty';
import * as pty from 'node-pty';
import type { ProcessStatus, ProjectProcessStatus, StartProcess } from '../../shared/types/process';

interface RunningProcess {
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

class ProcessManagerService {
  // Map of projectId -> Map of processId -> RunningProcess
  private runningProcesses: Map<string, Map<string, RunningProcess>> = new Map();

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
    if (!envVars.HOME) {
      envVars.HOME = process.env.HOME || require('os').homedir();
    }
    if (!envVars.USER) {
      envVars.USER = process.env.USER || require('os').userInfo().username;
    }
    if (!envVars.SHELL) {
      envVars.SHELL = process.env.SHELL || '/bin/bash';
    }

    // Start the process using node-pty for proper terminal emulation
    // Use login shell (-l) to load user's PATH (npm, node, etc.)
    // If command is provided, execute it; otherwise start an interactive shell
    const args = command ? ['-l', '-c', command] : ['-l'];

    return pty.spawn('/bin/bash', args, {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd,
      env: envVars,
    });
  }

  /**
   * Detect URLs from process output
   */
  private detectUrl(output: string): string | undefined {
    // First, strip all ANSI escape codes from the entire output
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

        // Determine working directory
        const cwd = processConfig.workingDir
          ? `${projectPath}/${processConfig.workingDir}`
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

        // Capture all output (stdout and stderr combined in PTY)
        ptyProcess.onData((data: string) => {
          runningProcess.output.push(data);

          // Keep only last 1000 lines to prevent memory issues
          if (runningProcess.output.length > 1000) {
            runningProcess.output = runningProcess.output.slice(-1000);
          }

          // Try to detect URL if not already detected and no configured URL
          if (!runningProcess.detectedUrl && !runningProcess.configuredUrl) {
            const detectedUrl = this.detectUrl(data);
            if (detectedUrl) {
              runningProcess.detectedUrl = detectedUrl;
              console.log(`Detected URL for process ${processConfig.name}: ${detectedUrl}`);
            }
          }
        });

        // Handle process exit
        ptyProcess.onExit(({ exitCode }) => {
          runningProcess.status = exitCode === 0 ? 'stopped' : 'failed';
          runningProcess.exitCode = exitCode;
        });

        projectProcesses.set(processConfig.id, runningProcess);

        statuses.push({
          processId: processConfig.id,
          projectId,
          name: processConfig.name,
          status: 'running',
          bashId,
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

    return allStatuses;
  }

  /**
   * Get the status of all processes for a project
   */
  getProcessStatus(projectId: string): ProjectProcessStatus {
    const projectProcesses = this.runningProcesses.get(projectId);

    if (!projectProcesses) {
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

    // Capture all output (stdout and stderr combined in PTY)
    ptyProcess.onData((data: string) => {
      runningProcess.output.push(data);

      // Keep only last 1000 lines
      if (runningProcess.output.length > 1000) {
        runningProcess.output = runningProcess.output.slice(-1000);
      }

      // Try to detect URL
      if (!runningProcess.detectedUrl) {
        const detectedUrl = this.detectUrl(data);
        if (detectedUrl) {
          runningProcess.detectedUrl = detectedUrl;
          console.log(`Detected URL for process ${title}: ${detectedUrl}`);
        }
      }
    });

    // Handle process exit
    ptyProcess.onExit(({ exitCode }) => {
      runningProcess.status = exitCode === 0 ? 'stopped' : 'failed';
      runningProcess.exitCode = exitCode;
    });

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
        });
      }
    }

    return allProcesses;
  }

  /**
   * Get a single process by ID across all projects
   */
  getProcess(processId: string): (ProcessStatus & { createdAt?: Date }) | null {
    for (const [projectId, projectProcesses] of this.runningProcesses.entries()) {
      if (projectProcesses.has(processId)) {
        const runningProcess = projectProcesses.get(processId)!;
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
          createdAt: runningProcess.createdAt,
        };
      }
    }
    return null;
  }

  /**
   * Kill a specific process by ID (search across all projects)
   */
  async killProcess(processId: string): Promise<boolean> {
    for (const [projectId, projectProcesses] of this.runningProcesses.entries()) {
      if (projectProcesses.has(processId)) {
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

        return true;
      }
    }
    return false;
  }

  /**
   * Get output from a process by ID (search across all projects)
   */
  getProcessOutputById(processId: string): string[] | null {
    for (const [projectId, projectProcesses] of this.runningProcesses.entries()) {
      if (projectProcesses.has(processId)) {
        const runningProcess = projectProcesses.get(processId)!;
        return runningProcess.output;
      }
    }
    return null;
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
