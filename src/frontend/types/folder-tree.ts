export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileNode[];
  extension?: string;
}

export interface FolderTreeNode {
  id: string;
  name: string;
  path: string;
  type: 'directory';
  children?: FileNode[];
}
