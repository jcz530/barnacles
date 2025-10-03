import { BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { APP_CONFIG } from '../shared/constants';
import { createRequire } from 'node:module';

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

export const createWindow = async (): Promise<BrowserWindow> => {
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
