import type { ApiMethod } from './api';
import type { UpdateInfo, DownloadProgress, UpdateError } from './updater';

export interface ApiConfig {
  port: number;
  baseUrl: string;
}

export interface ElectronAPI {
  apiCall: (_method: ApiMethod, _path: string, _body?: unknown) => Promise<unknown>;
  getApiConfig: () => Promise<ApiConfig>;

  // Update API
  updateGetVersion: () => Promise<string>;
  updateCheck: () => Promise<void>;
  updateDownload: () => Promise<void>;
  updateInstall: () => Promise<void>;

  // Update event listeners
  onUpdateChecking: (_callback: () => void) => () => void;
  onUpdateAvailable: (_callback: (info: UpdateInfo) => void) => () => void;
  onUpdateNotAvailable: (_callback: (info: UpdateInfo) => void) => () => void;
  onUpdateDownloadProgress: (_callback: (progress: DownloadProgress) => void) => () => void;
  onUpdateDownloaded: (_callback: (info: UpdateInfo) => void) => () => void;
  onUpdateError: (_callback: (error: UpdateError) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
