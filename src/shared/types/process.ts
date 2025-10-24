export interface StartProcess {
  id: string;
  name: string;
  commands: string[];
  workingDir?: string; // relative to project root
  color?: string;
  url?: string; // optional URL where the process will be accessible
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
}

export interface ProjectProcessStatus {
  projectId: string;
  processes: ProcessStatus[];
}
