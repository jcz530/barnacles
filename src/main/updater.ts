import { app, BrowserWindow, dialog } from 'electron';
import type { ProgressInfo, UpdateInfo } from 'electron-updater';
import { autoUpdater } from 'electron-updater';

// Configure auto-updater
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

let updateCheckInProgress = false;

/**
 * Initialize the auto-updater and set up event handlers
 */
export function initializeUpdater(): void {
  // Don't check for updates in development
  if (!app.isPackaged) {
    console.log('🔧 Auto-updater disabled in development mode');
    return;
  }

  console.log('🔄 Initializing auto-updater...');

  // Event: Checking for updates
  autoUpdater.on('checking-for-update', () => {
    console.log('🔍 Checking for updates...');
    updateCheckInProgress = true;
    sendToAllWindows('update:checking');
  });

  // Event: Update available
  autoUpdater.on('update-available', (info: UpdateInfo) => {
    console.log('✨ Update available:', info.version);
    updateCheckInProgress = false;
    sendToAllWindows('update:available', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });
  });

  // Event: No update available
  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    console.log('✅ App is up to date:', info.version);
    updateCheckInProgress = false;
    sendToAllWindows('update:not-available', {
      version: info.version,
    });
  });

  // Event: Download progress
  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    console.log(`📥 Download progress: ${progress.percent.toFixed(2)}%`);
    sendToAllWindows('update:download-progress', {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    });
  });

  // Event: Update downloaded
  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    console.log('✅ Update downloaded:', info.version);
    sendToAllWindows('update:downloaded', {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes,
    });
  });

  // Event: Error
  autoUpdater.on('error', (error: Error) => {
    console.error('❌ Update error:', error);
    updateCheckInProgress = false;
    sendToAllWindows('update:error', {
      message: error.message,
    });
  });

  // Don't check for updates automatically on startup
  // The check will be triggered by the renderer process when it's ready
}

/**
 * Manually check for updates
 */
export async function checkForUpdates(): Promise<void> {
  if (!app.isPackaged) {
    console.log('⚠️ Update check skipped: running in development mode');
    return;
  }

  if (updateCheckInProgress) {
    console.log('⚠️ Update check already in progress');
    return;
  }

  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    console.error('Failed to check for updates:', error);
  }
}

/**
 * Check for updates from a user-initiated action (the menu item), reporting the
 * outcome in a dialog.
 *
 * The renderer's own check is fire-and-forget: it listens for the broadcast
 * events and only surfaces something when there is an update to act on. A menu
 * click needs an answer either way, otherwise "Check for Updates..." looks
 * broken when you are already current -- so this resolves the check here and
 * says so.
 */
export async function checkForUpdatesInteractive(): Promise<void> {
  const parentWindow = BrowserWindow.getFocusedWindow() ?? undefined;
  const showMessage = async (options: Electron.MessageBoxOptions) => {
    if (parentWindow) {
      await dialog.showMessageBox(parentWindow, options);
    } else {
      await dialog.showMessageBox(options);
    }
  };

  // Updates are not wired up in development, so say that rather than silently
  // doing nothing.
  if (!app.isPackaged) {
    await showMessage({
      type: 'info',
      message: 'Update checks are disabled in development',
      detail: `Running Barnacles ${app.getVersion()} from source.`,
      buttons: ['OK'],
    });
    return;
  }

  if (updateCheckInProgress) {
    await showMessage({
      type: 'info',
      message: 'Already checking for updates',
      buttons: ['OK'],
    });
    return;
  }

  try {
    const result = await autoUpdater.checkForUpdates();
    // A null result means the check did not run at all (no update feed
    // configured, for instance) -- do not claim the app is up to date.
    if (!result) {
      await showMessage({
        type: 'info',
        message: 'Could not check for updates',
        detail: 'The update service did not respond. Please try again later.',
        buttons: ['OK'],
      });
      return;
    }

    // Trust the library's own verdict rather than comparing version strings,
    // which gets subtle with prereleases and build numbers. When an update does
    // exist, the renderer's UpdateNotification already offers to download it,
    // so there is nothing to say here.
    if (!result.isUpdateAvailable) {
      await showMessage({
        type: 'info',
        message: "You're up to date",
        detail: `Barnacles ${app.getVersion()} is the latest version.`,
        buttons: ['OK'],
      });
    }
  } catch (error) {
    console.error('Failed to check for updates:', error);
    await showMessage({
      type: 'error',
      message: 'Could not check for updates',
      detail: error instanceof Error ? error.message : String(error),
      buttons: ['OK'],
    });
  }
}

/**
 * Download the available update
 */
export async function downloadUpdate(): Promise<void> {
  if (!app.isPackaged) {
    console.log('⚠️ Update download skipped: running in development mode');
    return;
  }

  try {
    console.log('📥 Starting update download...');
    await autoUpdater.downloadUpdate();
  } catch (error) {
    console.error('Failed to download update:', error);
  }
}

/**
 * Quit and install the downloaded update
 */
export function quitAndInstall(): void {
  if (!app.isPackaged) {
    console.log('⚠️ Update install skipped: running in development mode');
    return;
  }

  console.log('🔄 Quitting and installing update...');
  autoUpdater.quitAndInstall(false, true);
}

/**
 * Get the current app version
 */
export function getCurrentVersion(): string {
  return app.getVersion();
}

/**
 * Send a message to all renderer windows
 */
function sendToAllWindows(channel: string, data?: unknown): void {
  const windows = BrowserWindow.getAllWindows();
  windows.forEach(window => {
    if (!window.isDestroyed()) {
      window.webContents.send(channel, data);
    }
  });
}
