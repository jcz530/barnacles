import { ipcMain } from 'electron';
import type { ApiMethod } from '../../shared/types/api';
import { RUNTIME_CONFIG } from '../../shared/constants';

export const setupAPIBridge = (): void => {
  // Handle API calls
  ipcMain.handle(
    'api-call',
    async (
      _,
      {
        method,
        path,
        body,
      }: {
        method: ApiMethod;
        path: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body?: any; // IPC body can be any JSON-serializable data
      }
    ) => {
      try {
        const url = `${RUNTIME_CONFIG.API_BASE_URL}${path}`;

        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: body ? JSON.stringify(body) : undefined,
        });

        const data = await response.json();

        if (!response.ok) {
          // Create an error with the full response data
          const error = new Error(
            data.error || data.message || `HTTP ${response.status}: ${response.statusText}`
          ) as Error & {
            response?: { status: number; data: any };
          };

          // Attach response details so frontend can access them
          error.response = {
            status: response.status,
            data,
          };

          throw error;
        }

        return data;
      } catch (error) {
        console.error('API Bridge Error:', error);
        throw error;
      }
    }
  );

  // Handle API config requests
  ipcMain.handle('get-api-config', () => {
    return {
      port: RUNTIME_CONFIG.API_PORT,
      baseUrl: RUNTIME_CONFIG.API_BASE_URL,
    };
  });
};
