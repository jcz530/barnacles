import { spawn } from 'child_process';
import os from 'os';
import { createId } from '@paralleldrive/cuid2';

export interface Terminal {
  id: string;
  title: string;
  cwd: string;
  projectId?: string;
  command?: string;
  createdAt: Date;
  status: 'running' | 'exited';
  exitCode?: number;
}

export interface TerminalProcess extends Terminal {
  process: ReturnType<typeof spawn>;
}

class TerminalService {
  private terminals: Map<string, TerminalProcess> = new Map();

  /**
   * Create a new terminal instance
   */
  createTerminal(options: {
    cwd?: string;
    projectId?: string;
    command?: string;
    title?: string;
  }): Terminal {
    const id = createId();
    const shell = this.getDefaultShell();
    const workingDir = options.cwd || os.homedir();

    // If command is provided, execute it; otherwise start an interactive shell
    const args = options.command ? ['-c', options.command] : [];

    const childProcess = spawn(shell, args, {
      cwd: workingDir,
      env: { ...process.env },
      // Use a pseudo-terminal-like behavior
      shell: false,
    });

    const terminal: TerminalProcess = {
      id,
      title: options.title || (options.command ? `Running: ${options.command}` : 'Terminal'),
      cwd: workingDir,
      projectId: options.projectId,
      command: options.command,
      createdAt: new Date(),
      status: 'running',
      process: childProcess,
    };

    // Handle process exit
    childProcess.on('exit', code => {
      terminal.status = 'exited';
      terminal.exitCode = code || 0;
    });

    this.terminals.set(id, terminal);

    return this.sanitizeTerminal(terminal);
  }

  /**
   * Get a terminal by ID
   */
  getTerminal(id: string): Terminal | undefined {
    const terminal = this.terminals.get(id);
    return terminal ? this.sanitizeTerminal(terminal) : undefined;
  }

  /**
   * Get all terminals
   */
  getAllTerminals(): Terminal[] {
    return Array.from(this.terminals.values()).map(t => this.sanitizeTerminal(t));
  }

  /**
   * Get terminals for a specific project
   */
  getProjectTerminals(projectId: string): Terminal[] {
    return Array.from(this.terminals.values())
      .filter(t => t.projectId === projectId)
      .map(t => this.sanitizeTerminal(t));
  }

  /**
   * Write data to a terminal
   */
  writeToTerminal(id: string, data: string): boolean {
    const terminal = this.terminals.get(id);
    if (!terminal || terminal.status === 'exited') {
      return false;
    }

    terminal.process.stdin?.write(data);
    return true;
  }

  /**
   * Resize a terminal (placeholder for future PTY implementation)
   */
  resizeTerminal(id: string, cols: number, rows: number): boolean {
    const terminal = this.terminals.get(id);
    if (!terminal || terminal.status === 'exited') {
      return false;
    }

    // Note: This is a no-op with child_process, but included for API consistency
    // When we implement PTY, we'll add: terminal.process.resize(cols, rows);
    return true;
  }

  /**
   * Kill a terminal
   */
  killTerminal(id: string): boolean {
    const terminal = this.terminals.get(id);
    if (!terminal) {
      return false;
    }

    if (terminal.status === 'running') {
      terminal.process.kill();
    }

    this.terminals.delete(id);
    return true;
  }

  /**
   * Get the child process for a terminal (used for streaming data)
   */
  getTerminalProcess(id: string): ReturnType<typeof spawn> | undefined {
    return this.terminals.get(id)?.process;
  }

  /**
   * Get the default shell for the platform
   */
  private getDefaultShell(): string {
    const platform = os.platform();

    if (platform === 'win32') {
      return process.env.COMSPEC || 'cmd.exe';
    }

    return process.env.SHELL || '/bin/bash';
  }

  /**
   * Remove the process object before returning terminal info
   */
  private sanitizeTerminal(terminal: TerminalProcess): Terminal {
    const { process: _, ...sanitized } = terminal;
    return sanitized;
  }

  /**
   * Clean up all terminals on shutdown
   */
  cleanup(): void {
    for (const [id, terminal] of this.terminals.entries()) {
      if (terminal.status === 'running') {
        terminal.process.kill();
      }
    }
    this.terminals.clear();
  }
}

export const terminalService = new TerminalService();
