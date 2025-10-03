import { contextBridge, ipcRenderer } from 'electron';
import type { ApiMethod } from './shared/types/api';

// Expose API methods to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // API call method
  apiCall: (
    method: ApiMethod,
    path: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    body?: any // Electron IPC contract requires any
  ) => ipcRenderer.invoke('api-call', { method, path, body }),

  // Get API configuration
  getApiConfig: () => ipcRenderer.invoke('get-api-config'),
});
