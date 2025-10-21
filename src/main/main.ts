import { app, BrowserWindow } from 'electron';
import contextMenu from 'electron-context-menu';
import started from 'electron-squirrel-startup';
import { startServer } from '../backend/server';
import { setupIPC } from './ipc';
import { createMenu } from './menu';
import { initializeUpdater } from './updater';
import { createWindow } from './window-manager';
import { createTray, updateTrayMenu, destroyTray } from './tray-manager';
import { settingsService } from '../backend/services/settings-service';

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (started) {
  app.quit();
}

// Track all windows
const windows = new Set<BrowserWindow>();
let apiPort: number | undefined;

// Track if the app is quitting
let isQuitting = false;

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
  updateTrayMenu();

  // Modify close behavior to hide window instead of closing (only when tray is enabled)
  newWindow.on('close', async event => {
    if (!isQuitting) {
      const showTrayIcon = await settingsService.getValue<boolean>('showTrayIcon');
      if (showTrayIcon) {
        event.preventDefault();
        newWindow.hide();
      }
    }
  });

  newWindow.on('closed', () => {
    windows.delete(newWindow);
    // Rebuild menu to update window list
    createMenu();
    updateTrayMenu();
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

/**
 * Toggle the system tray icon on/off
 */
export const toggleTrayIcon = async (enabled: boolean): Promise<void> => {
  if (enabled) {
    createTray();
  } else {
    destroyTray();
  }
};

const initialize = async (): Promise<void> => {
  try {
    // Start the API server
    const serverInfo = await startServer();
    apiPort = serverInfo.port;

    // Setup IPC communication
    setupIPC();

    // Initialize auto-updater
    initializeUpdater();

    // Create the application menu
    createMenu();

    // Create the system tray if enabled in settings
    const showTrayIcon = await settingsService.getValue<boolean>('showTrayIcon');
    if (showTrayIcon) {
      createTray();
    }

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

app.on('before-quit', () => {
  // Set quitting flag so windows can close properly
  isQuitting = true;
});

app.on('window-all-closed', async () => {
  // Only keep app running if tray icon is enabled
  const showTrayIcon = await settingsService.getValue<boolean>('showTrayIcon');

  // On macOS, keep app running by default; on other platforms, only if tray is enabled
  if (process.platform !== 'darwin' && !showTrayIcon) {
    app.quit();
  }
});

app.on('activate', async () => {
  // On macOS, show or create a window when the dock icon is clicked
  const visibleWindows = BrowserWindow.getAllWindows().filter(win => win.isVisible());

  if (visibleWindows.length === 0) {
    const allWindows = BrowserWindow.getAllWindows();
    if (allWindows.length > 0) {
      // Show the first hidden window
      allWindows[0].show();
      allWindows[0].focus();
    } else {
      // Create a new window if none exist
      await createAppWindow();
    }
  }
});

// Security: Prevent unauthorized new window creation
app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});
