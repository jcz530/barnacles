export interface User {
  id: string;
  name: string;
  email: string;
}

export interface Technology {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  color?: string | null;
}

export interface ProjectStats {
  id: string;
  projectId: string;
  fileCount?: number | null;
  directoryCount?: number | null;
  languageStats?: string | null;
  gitBranch?: string | null;
  gitStatus?: string | null;
  gitRemoteUrl?: string | null;
  lastCommitDate?: Date | null;
  lastCommitMessage?: string | null;
  hasUncommittedChanges?: boolean | null;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  description?: string | null;
  lastModified?: Date | null;
  size?: number | null;
  status: 'active' | 'archived';
  preferredIde?: string | null;
  preferredTerminal?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDE {
  id: string;
  name: string;
  executable: string;
  command: string;
  icon?: string;
  color?: string;
}

export interface DetectedIDE extends IDE {
  installed: boolean;
  version?: string;
}

export interface Terminal {
  id: string;
  name: string;
  executable: string;
  command: string;
  icon?: string;
  color?: string;
}

export interface DetectedTerminal extends Terminal {
  installed: boolean;
  version?: string;
}

export interface TerminalInstance {
  id: string;
  title: string;
  cwd: string;
  projectId?: string;
  command?: string;
  createdAt: Date;
  status: 'running' | 'exited';
  exitCode?: number;
}

export interface ProjectWithDetails extends Project {
  technologies: Technology[];
  stats?: ProjectStats | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ApiResponse<T = any> {
  // Generic type with flexible default
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface HelloResponse {
  message: string;
}

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
