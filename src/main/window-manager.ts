import { BrowserWindow, session } from 'electron';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_CONFIG } from '../shared/constants';

createRequire(import.meta.url);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const checkViteDevServer = async (): Promise<boolean> => {
  try {
    const response = await fetch('http://localhost:5173');
    return response.ok;
  } catch {
    return false;
  }
};

export const createWindow = async (apiPort?: number): Promise<BrowserWindow> => {
  // Set Content Security Policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    // Build connect-src with specific ports if available
    const viteDevServer = 'ws://localhost:5173';
    const apiServer = apiPort
      ? `http://localhost:${apiPort} ws://localhost:${apiPort}`
      : 'http://localhost:* ws://localhost:*';
    const connectSrc = `'self' ${apiServer} ${viteDevServer}`;

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
            "script-src 'self'; " +
            "style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data: https:; " +
            "font-src 'self' data:; " +
            `connect-src ${connectSrc}; ` +
            "object-src 'none'; " +
            "base-uri 'self'",
        ],
      },
    });
  });

  const mainWindow = new BrowserWindow({
    width: APP_CONFIG.WINDOW_SIZE.width,
    height: APP_CONFIG.WINDOW_SIZE.height,
    minWidth: APP_CONFIG.WINDOW_SIZE.minWidth,
    minHeight: APP_CONFIG.WINDOW_SIZE.minHeight,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'default',
    show: false, // Don't show until ready-to-show
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Load the appropriate content
  const isDevServer = await checkViteDevServer();
  if (isDevServer) {
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return mainWindow;
};
