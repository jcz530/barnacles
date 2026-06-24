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
