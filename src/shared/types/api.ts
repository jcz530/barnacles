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
  gitBranch?: string | null;
  gitStatus?: string | null;
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
  createdAt: Date;
  updatedAt: Date;
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
