import { app, BrowserWindow } from 'electron';
import contextMenu from 'electron-context-menu';
import started from 'electron-squirrel-startup';
import { startServer } from '../backend/server';
import { setupIPC } from './ipc';
import { createMenu } from './menu';
import { createWindow } from './window-manager';

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (started) {
  app.quit();
}

// Track all windows
const windows = new Set<BrowserWindow>();
let apiPort: number | undefined;

// Enable right-click context menu with Inspect Element in development mode
contextMenu({
  showInspectElement: !app.isPackaged,
});

// Function to create and track a new window
export const createAppWindow = async (): Promise<BrowserWindow> => {
  const newWindow = await createWindow(apiPort);
  windows.add(newWindow);

  // Rebuild menu to update window list
  createMenu();

  newWindow.on('closed', () => {
    windows.delete(newWindow);
    // Rebuild menu to update window list
    createMenu();
  });

  // Update menu when window focus changes
  newWindow.on('focus', () => {
    createMenu();
  });

  newWindow.on('blur', () => {
    createMenu();
  });

  return newWindow;
};

const initialize = async (): Promise<void> => {
  try {
    // Start the API server
    const serverInfo = await startServer();
    apiPort = serverInfo.port;

    // Setup IPC communication
    setupIPC();

    // Create the application menu
    createMenu();

    // Create the main window with the actual API port for CSP
    await createAppWindow();

    console.log('🚀 Application initialized successfully');
    console.log(`📡 API available at ${serverInfo.baseUrl}`);
  } catch (error) {
    console.error('Failed to initialize application:', error);
    app.quit();
  }
};

// App event handlers
app.on('ready', initialize);

app.on('window-all-closed', () => {
  // On macOS, keep the app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  // On macOS, re-create a window when the dock icon is clicked
  if (BrowserWindow.getAllWindows().length === 0) {
    await createAppWindow();
  }
});

// Security: Prevent unauthorized new window creation
app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});
