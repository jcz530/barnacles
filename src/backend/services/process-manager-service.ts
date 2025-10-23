import { exec } from 'child_process';
import { promisify } from 'util';
import type { ProcessStatus, ProjectProcessStatus, StartProcess } from '../../shared/types/process';

const execAsync = promisify(exec);

interface RunningProcess {
  name: string;
  bashId: string;
  process: ReturnType<typeof exec>;
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

    for (const process of processes) {
      // Skip if already running
      if (projectProcesses.has(process.id)) {
        const existing = projectProcesses.get(process.id)!;
        statuses.push({
          processId: process.id,
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
        const commandString = process.commands.join(' && ');

        // Determine working directory
        const cwd = process.workingDir ? `${projectPath}/${process.workingDir}` : projectPath;

        // Start the process
        const childProcess = exec(commandString, {
          cwd,
          shell: '/bin/bash',
        });

        // Generate a bash ID (simulating background bash sessions)
        const bashId = `${projectId}-${process.id}-${Date.now()}`;

        const runningProcess: RunningProcess = {
          name: process.name,
          bashId,
          process: childProcess,
          status: 'running',
          output: [],
          configuredUrl: process.url,
          createdAt: new Date(),
        };

        // Capture stdout
        childProcess.stdout?.on('data', (data: Buffer) => {
          const text = data.toString();
          runningProcess.output.push(text);

          // Keep only last 1000 lines to prevent memory issues
          if (runningProcess.output.length > 1000) {
            runningProcess.output = runningProcess.output.slice(-1000);
          }

          // Try to detect URL if not already detected and no configured URL
          if (!runningProcess.detectedUrl && !runningProcess.configuredUrl) {
            const detectedUrl = this.detectUrl(text);
            if (detectedUrl) {
              runningProcess.detectedUrl = detectedUrl;
              console.log(`Detected URL for process ${process.name}: ${detectedUrl}`);
            }
          }
        });

        // Capture stderr
        childProcess.stderr?.on('data', (data: Buffer) => {
          const text = data.toString();
          runningProcess.output.push(text);

          // Keep only last 1000 lines
          if (runningProcess.output.length > 1000) {
            runningProcess.output = runningProcess.output.slice(-1000);
          }

          // Some servers output URLs to stderr
          if (!runningProcess.detectedUrl && !runningProcess.configuredUrl) {
            const detectedUrl = this.detectUrl(text);
            if (detectedUrl) {
              runningProcess.detectedUrl = detectedUrl;
              console.log(`Detected URL for process ${process.name}: ${detectedUrl}`);
            }
          }
        });

        // Handle process exit
        childProcess.on('exit', code => {
          runningProcess.status = code === 0 ? 'stopped' : 'failed';
          runningProcess.exitCode = code ?? undefined;
        });

        // Handle process errors
        childProcess.on('error', error => {
          runningProcess.status = 'failed';
          runningProcess.error = error.message;
        });

        projectProcesses.set(process.id, runningProcess);

        statuses.push({
          processId: process.id,
          projectId,
          name: process.name,
          status: 'running',
          bashId,
        });
      } catch (error) {
        statuses.push({
          processId: process.id,
          projectId,
          name: process.name,
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
        runningProcess.process.kill('SIGTERM');
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
      runningProcess.process.kill('SIGTERM');
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

    // Determine the command to run
    const command = params.command || process.env.SHELL || '/bin/bash';
    const cwd = params.cwd || process.cwd();
    const title = params.title || (params.command ? `Running: ${params.command}` : 'Process');

    // Start the process
    const childProcess = exec(command, {
      cwd,
      shell: '/bin/bash',
    });

    const bashId = `${projectId}-${processId}-${Date.now()}`;

    const runningProcess: RunningProcess = {
      name: title,
      title,
      command: params.command,
      cwd,
      bashId,
      process: childProcess,
      status: 'running',
      output: [],
      createdAt: new Date(),
    };

    // Capture stdout
    childProcess.stdout?.on('data', (data: Buffer) => {
      const text = data.toString();
      runningProcess.output.push(text);

      // Keep only last 1000 lines
      if (runningProcess.output.length > 1000) {
        runningProcess.output = runningProcess.output.slice(-1000);
      }

      // Try to detect URL
      if (!runningProcess.detectedUrl) {
        const detectedUrl = this.detectUrl(text);
        if (detectedUrl) {
          runningProcess.detectedUrl = detectedUrl;
          console.log(`Detected URL for process ${title}: ${detectedUrl}`);
        }
      }
    });

    // Capture stderr
    childProcess.stderr?.on('data', (data: Buffer) => {
      const text = data.toString();
      runningProcess.output.push(text);

      if (runningProcess.output.length > 1000) {
        runningProcess.output = runningProcess.output.slice(-1000);
      }

      if (!runningProcess.detectedUrl) {
        const detectedUrl = this.detectUrl(text);
        if (detectedUrl) {
          runningProcess.detectedUrl = detectedUrl;
        }
      }
    });

    // Handle process exit
    childProcess.on('exit', code => {
      runningProcess.status = code === 0 ? 'stopped' : 'failed';
      runningProcess.exitCode = code ?? undefined;
    });

    // Handle process errors
    childProcess.on('error', error => {
      runningProcess.status = 'failed';
      runningProcess.error = error.message;
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
          runningProcess.process.kill('SIGTERM');
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
