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
      showOrCreateWindow: () => Promise<{
        success: boolean;
        windowId?: number;
        wasExisting?: boolean;
        error?: string;
      }>;
      createNewWindow: () => Promise<{ success: boolean; windowId?: number; error?: string }>;
      navigateToProject: (path: string) => Promise<{ success: boolean; error?: string }>;
      onNavigateToProject: (callback: (path: string) => void) => () => void;
      onToggleFind: (callback: () => void) => () => void;
      quitApp: () => Promise<{ success: boolean; error?: string }>;
      cli: {
        isInstalled: () => Promise<boolean>;
        install: () => Promise<{ success: boolean; error?: string }>;
        uninstall: () => Promise<{ success: boolean; error?: string }>;
      };
      files: {
        readDirectory: (
          dirPath: string,
          customExclusions?: string[]
        ) => Promise<{ success: boolean; data?: FileNode[]; error?: string }>;
        getGlobalExclusions: (
          dirPath: string
        ) => Promise<{ success: boolean; data?: string[]; error?: string }>;
        readFile: (
          filePath: string,
          forceText?: boolean
        ) => Promise<{
          success: boolean;
          data?: { content: string; type: 'text' | 'binary'; size: number };
          error?: string;
        }>;
        readFileBinary: (filePath: string) => Promise<{
          success: boolean;
          data?: { buffer: Uint8Array; size: number };
          error?: string;
        }>;
        getFileStats: (filePath: string) => Promise<{
          success: boolean;
          data?: {
            size: number;
            mtime: Date;
            ctime: Date;
            isFile: boolean;
            isDirectory: boolean;
          };
          error?: string;
        }>;
        searchContent: (
          dirPath: string,
          query: string
        ) => Promise<{ success: boolean; data?: SearchResult[]; error?: string }>;
        selectFolder: () => Promise<{
          success: boolean;
          data?: string;
          canceled?: boolean;
          error?: string;
        }>;
        moveFiles: (
          filePaths: string[],
          targetFolder: string
        ) => Promise<{
          success: boolean;
          results?: Array<{ file: string; success: boolean; error?: string }>;
          error?: string;
        }>;
        getPathForFile: (file: File) => string;
      };
      screenshot: {
        captureUrl: (request: {
          url: string;
          port: number;
          processName: string;
          signature: string | null;
        }) => Promise<{
          success: boolean;
          data?: { fileName: string; capturedAt: Date };
          error?: string;
        }>;
      };
      find: {
        close: () => void;
        toggle: () => void;
        start: (searchText: string, options?: {
          forward?: boolean;
          findNext?: boolean;
          matchCase?: boolean;
          wordStart?: boolean;
          medialCapitalAsWordStart?: boolean;
        }) => Promise<{ success: boolean; requestId?: number; error?: string }>;
        stop: (action: 'clearSelection' | 'keepSelection' | 'activateSelection') => Promise<{ success: boolean; error?: string }>;
        setupListener: () => void;
        onResult: (callback: (result: {
          requestId: number;
          activeMatchOrdinal: number;
          matches: number;
          selectionArea: { x: number; y: number; width: number; height: number };
          finalUpdate: boolean;
        }) => void) => () => void;
      };
    };
  }
}
