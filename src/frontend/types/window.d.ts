export {};

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  children?: FileNode[];
  extension?: string;
}

export interface SearchResult {
  filePath: string;
  fileName: string;
  lineNumber: number;
  lineContent: string;
  matchStart: number;
  matchEnd: number;
}

declare global {
  interface Window {
    electronAPI: {
      apiCall: (method: string, path: string, body?: unknown) => Promise<unknown>;
      getApiConfig: () => Promise<{ port: number; baseUrl: string }>;
    };
    electron: {
      shell: {
        openPath: (path: string) => Promise<string>;
        showItemInFolder: (path: string) => Promise<void>;
        openExternal: (url: string) => Promise<void>;
      };
      clipboard: {
        writeFile: (path: string) => Promise<{ success: boolean; error?: string }>;
      };
      updateWindowTitle: (title: string) => void;
      createNewWindow: () => Promise<{ success: boolean; windowId?: number; error?: string }>;
      quitApp: () => Promise<{ success: boolean; error?: string }>;
      cli: {
        isInstalled: () => Promise<boolean>;
        install: () => Promise<{ success: boolean; error?: string }>;
        uninstall: () => Promise<{ success: boolean; error?: string }>;
      };
      files: {
        readDirectory: (
          dirPath: string
        ) => Promise<{ success: boolean; data?: FileNode[]; error?: string }>;
        readFile: (
          filePath: string,
          forceText?: boolean
        ) => Promise<{
          success: boolean;
          data?: { content: string; type: 'text' | 'binary'; size: number };
          error?: string;
        }>;
        searchContent: (
          dirPath: string,
          query: string
        ) => Promise<{ success: boolean; data?: SearchResult[]; error?: string }>;
        selectFolder: () => Promise<{ success: boolean; data?: string; canceled?: boolean; error?: string }>;
        moveFiles: (
          filePaths: string[],
          targetFolder: string
        ) => Promise<{
          success: boolean;
          results?: Array<{ file: string; success: boolean; error?: string }>;
          error?: string;
        }>;
      };
    };
  }
}
