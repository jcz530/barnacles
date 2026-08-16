/**
 * Entry point for the screenshot capture script.
 *
 * Boots exactly what a screenshot needs — the API server plus the IPC bridges
 * the renderer talks through — and nothing that would interfere: no tray, no
 * menus, no single-instance lock, no application window.
 */
import { startServer } from '../backend/server';
import { setupIPC } from './ipc';

export interface ScreenshotHost {
  port: number;
  baseUrl: string;
}

export async function startScreenshotHost(): Promise<ScreenshotHost> {
  const { port, baseUrl } = await startServer();

  // The renderer resolves data over IPC (see useApiPort and the api-call
  // bridge), so the bridges must be registered or every page renders empty.
  setupIPC();

  return { port, baseUrl };
}
