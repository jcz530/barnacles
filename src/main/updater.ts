import { app, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { UpdateInfo, ProgressInfo } from 'electron-updater';

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

  // Check for updates on app startup (after a short delay)
  setTimeout(() => {
    checkForUpdates();
  }, 5000);
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
