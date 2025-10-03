import { app, BrowserWindow } from 'electron';
import started from 'electron-squirrel-startup';
import { startServer } from '../backend/server';
import { createWindow } from './window-manager';
import { setupIPC } from './ipc';

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (started) {
  app.quit();
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
let mainWindow: BrowserWindow | null = null;

const initialize = async (): Promise<void> => {
  try {
    // Start the API server
    const serverInfo = await startServer();

    // Setup IPC communication
    setupIPC();

    // Create the main window
    mainWindow = await createWindow();

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
    mainWindow = await createWindow();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (_, contents) => {
  contents.on('new-window', event => {
    event.preventDefault();
  });
});
