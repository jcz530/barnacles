import type { ApiMethod } from './api';

export interface ApiConfig {
  port: number;
  baseUrl: string;
}

export interface ElectronAPI {
  apiCall: (_method: ApiMethod, _path: string, _body?: unknown) => Promise<unknown>;
  getApiConfig: () => Promise<ApiConfig>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
