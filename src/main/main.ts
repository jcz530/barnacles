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
import { installCli, uninstallCli, isCliInstalled } from './cli-manager';

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (started) {
  app.quit();
}

// Track all windows
const windows = new Set<BrowserWindow>();
let apiPort: number | undefined;

// Track if the app is quitting
let isQuitting = false;

// Track if we're currently showing the tray popup to prevent activate event interference
let isShowingTrayPopup = false;

/**
 * Set flag to indicate tray popup is being shown
 * This prevents the activate event from showing hidden main windows
 */
export const setShowingTrayPopup = (showing: boolean): void => {
  isShowingTrayPopup = showing;
};

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

/**
 * Toggle CLI installation based on settings
 */
export const toggleCliInstallation = async (enabled: boolean): Promise<void> => {
  const currentlyInstalled = isCliInstalled();

  if (enabled && !currentlyInstalled) {
    // Should be installed but isn't - install it
    console.log('[CLI] Installing CLI symlink...');
    const result = await installCli();
    if (result.success) {
      console.log('✅ CLI command installed at ~/.local/bin/barnacles');
      console.log(
        '[CLI] NOTE: You may need to restart your terminal for the command to be available'
      );
    } else {
      console.error('❌ Failed to install CLI:', result.error);
    }
  } else if (!enabled && currentlyInstalled) {
    // Shouldn't be installed but is - uninstall it
    console.log('[CLI] Uninstalling CLI symlink...');
    const result = await uninstallCli();
    if (result.success) {
      console.log('✅ CLI command uninstalled');
    } else {
      console.error('❌ Failed to uninstall CLI:', result.error);
    }
  } else if (enabled && currentlyInstalled) {
    console.log('[CLI] CLI command is already installed');
  }
};

const initialize = async (): Promise<void> => {
  try {
    // Fix PATH on macOS - Electron doesn't inherit the full shell PATH
    if (process.platform === 'darwin') {
      try {
        const { execSync } = await import('child_process');
        const shell = process.env.SHELL || '/bin/bash';
        // Get the PATH from the user's login shell
        const fullPath = execSync(`${shell} -ilc 'echo $PATH'`, {
          encoding: 'utf8',
          timeout: 5000,
        }).trim();

        if (fullPath && fullPath !== process.env.PATH) {
          console.log('[Environment] Fixing PATH environment variable');
          console.log('[Environment] Old PATH:', process.env.PATH?.substring(0, 100));
          console.log('[Environment] New PATH:', fullPath.substring(0, 100));
          process.env.PATH = fullPath;
        }
      } catch (error) {
        console.error('[Environment] Failed to fix PATH:', error);
      }
    }

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

    // Install CLI command if enabled in settings
    const shouldInstallCli = await settingsService.getValue<boolean>('installCliCommand');
    if (shouldInstallCli !== false) {
      // Default to true if not set
      console.log('[CLI] Installing CLI command...');
      try {
        await toggleCliInstallation(true);
        console.log('[CLI] CLI command installation completed');
      } catch (error) {
        console.error('[CLI] Failed to install CLI command:', error);
      }
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
  if (process.env.NODE_ENV === 'development') {
    console.log('[App] Activate event triggered', { isShowingTrayPopup });
  }

  // Don't show main window if we're currently showing the tray popup
  if (isShowingTrayPopup) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[App] Ignoring activate event - tray popup is being shown');
    }
    return;
  }

  // On macOS, show or create a window when the dock icon is clicked
  // Exclude tray popup and other utility windows
  const allWindows = BrowserWindow.getAllWindows();
  const mainWindows = allWindows.filter(
    win =>
      !win.isDestroyed() &&
      !win.skipTaskbar &&
      win.isResizable() && // Main windows are resizable, tray popup is not
      !win.isAlwaysOnTop() // Main windows are not always on top, tray popup is
  );
  const visibleMainWindows = mainWindows.filter(win => win.isVisible());

  if (process.env.NODE_ENV === 'development') {
    console.log('[App] Window counts:', {
      total: allWindows.length,
      mainWindows: mainWindows.length,
      visibleMainWindows: visibleMainWindows.length,
    });
  }

  if (visibleMainWindows.length === 0) {
    if (mainWindows.length > 0) {
      // Show the first hidden main window
      mainWindows[0].show();
      mainWindows[0].focus();
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
