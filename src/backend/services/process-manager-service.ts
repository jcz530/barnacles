import { exec } from 'child_process';
import { promisify } from 'util';
import type { StartProcess, ProcessStatus, ProjectProcessStatus } from '../../shared/types/process';

const execAsync = promisify(exec);

interface RunningProcess {
  bashId: string;
  process: ReturnType<typeof exec>;
  status: 'running' | 'stopped' | 'failed';
  exitCode?: number;
  error?: string;
}

class ProcessManagerService {
  // Map of projectId -> Map of processId -> RunningProcess
  private runningProcesses: Map<string, Map<string, RunningProcess>> = new Map();

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
          bashId,
          process: childProcess,
          status: 'running',
        };

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
          status: 'running',
          bashId,
        });
      } catch (error) {
        statuses.push({
          processId: process.id,
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
        status: runningProcess.status,
        bashId: runningProcess.bashId,
        exitCode: runningProcess.exitCode,
        error: runningProcess.error,
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
  getProcessOutput(projectId: string, processId: string): string | null {
    const projectProcesses = this.runningProcesses.get(projectId);

    if (!projectProcesses || !projectProcesses.has(processId)) {
      return null;
    }

    const runningProcess = projectProcesses.get(processId)!;

    // In a real implementation, you would capture stdout/stderr
    // For now, we'll return a placeholder
    return `Output for process ${processId}`;
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
   * Clean up all processes (call on app shutdown)
   */
  async cleanup(): Promise<void> {
    for (const projectId of this.runningProcesses.keys()) {
      await this.stopProjectProcesses(projectId);
    }
  }
}

export const processManagerService = new ProcessManagerService();
