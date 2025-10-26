import { contextBridge, ipcRenderer } from 'electron';
import type { ApiMethod } from './shared/types/api';
import type { UpdateInfo, DownloadProgress, UpdateError } from './shared/types/updater';

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

  // Update methods
  updateGetVersion: () => ipcRenderer.invoke('update:get-version'),
  updateCheck: () => ipcRenderer.invoke('update:check'),
  updateDownload: () => ipcRenderer.invoke('update:download'),
  updateInstall: () => ipcRenderer.invoke('update:install'),

  // Update event listeners
  onUpdateChecking: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('update:checking', handler);
    return () => ipcRenderer.removeListener('update:checking', handler);
  },
  onUpdateAvailable: (callback: (info: UpdateInfo) => void) => {
    const handler = (_: unknown, info: UpdateInfo) => callback(info);
    ipcRenderer.on('update:available', handler);
    return () => ipcRenderer.removeListener('update:available', handler);
  },
  onUpdateNotAvailable: (callback: (info: UpdateInfo) => void) => {
    const handler = (_: unknown, info: UpdateInfo) => callback(info);
    ipcRenderer.on('update:not-available', handler);
    return () => ipcRenderer.removeListener('update:not-available', handler);
  },
  onUpdateDownloadProgress: (callback: (progress: DownloadProgress) => void) => {
    const handler = (_: unknown, progress: DownloadProgress) => callback(progress);
    ipcRenderer.on('update:download-progress', handler);
    return () => ipcRenderer.removeListener('update:download-progress', handler);
  },
  onUpdateDownloaded: (callback: (info: UpdateInfo) => void) => {
    const handler = (_: unknown, info: UpdateInfo) => callback(info);
    ipcRenderer.on('update:downloaded', handler);
    return () => ipcRenderer.removeListener('update:downloaded', handler);
  },
  onUpdateError: (callback: (error: UpdateError) => void) => {
    const handler = (_: unknown, error: UpdateError) => callback(error);
    ipcRenderer.on('update:error', handler);
    return () => ipcRenderer.removeListener('update:error', handler);
  },
});

// Expose shell methods to renderer process
contextBridge.exposeInMainWorld('electron', {
  shell: {
    openPath: (path: string) => ipcRenderer.invoke('shell:open-path', path),
    openExternal: (url: string) => ipcRenderer.invoke('shell:open-external', url),
  },
  updateWindowTitle: (title: string) => ipcRenderer.send('update-window-title', title),
  createNewWindow: () => ipcRenderer.invoke('create-new-window'),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  cli: {
    isInstalled: () => ipcRenderer.invoke('cli:isInstalled'),
    install: () => ipcRenderer.invoke('cli:install'),
    uninstall: () => ipcRenderer.invoke('cli:uninstall'),
  },
  files: {
    readDirectory: (dirPath: string) => ipcRenderer.invoke('files:read-directory', dirPath),
    readFile: (filePath: string) => ipcRenderer.invoke('files:read-file', filePath),
    searchContent: (dirPath: string, query: string) =>
      ipcRenderer.invoke('files:search-content', dirPath, query),
  },
});
