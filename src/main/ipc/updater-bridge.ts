import { ipcMain } from 'electron';
import { checkForUpdates, downloadUpdate, quitAndInstall, getCurrentVersion } from '../updater';

export const setupUpdaterBridge = (): void => {
  // Get current app version
  ipcMain.handle('update:get-version', () => {
    return getCurrentVersion();
  });

  // Check for updates manually
  ipcMain.handle('update:check', async () => {
    await checkForUpdates();
  });

  // Download available update
  ipcMain.handle('update:download', async () => {
    await downloadUpdate();
  });

  // Install downloaded update
  ipcMain.handle('update:install', () => {
    quitAndInstall();
  });
};
