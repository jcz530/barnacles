export {};

declare global {
  interface Window {
    electronAPI: {
      apiCall: (method: string, path: string, body?: unknown) => Promise<unknown>;
      getApiConfig: () => Promise<{ port: number; baseUrl: string }>;
    };
    electron: {
      shell: {
        openPath: (path: string) => Promise<string>;
        openExternal: (url: string) => Promise<void>;
      };
      updateWindowTitle: (title: string) => void;
      createNewWindow: () => Promise<{ success: boolean; windowId?: number; error?: string }>;
      quitApp: () => Promise<{ success: boolean; error?: string }>;
      cli: {
        isInstalled: () => Promise<boolean>;
        install: () => Promise<{ success: boolean; error?: string }>;
        uninstall: () => Promise<{ success: boolean; error?: string }>;
      };
    };
  }
}
