export interface StartProcess {
  id: string;
  name: string;
  commands: string[];
  workingDir?: string; // relative to project root
  color?: string;
}

export interface ProcessStatus {
  processId: string;
  status: 'running' | 'stopped' | 'failed';
  bashId?: string; // ID of the background bash session
  exitCode?: number;
  error?: string;
}

export interface ProjectProcessStatus {
  projectId: string;
  processes: ProcessStatus[];
}
