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
  name?: string; // Process name from StartProcess
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
