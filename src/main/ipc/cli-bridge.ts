import { ipcMain } from 'electron';
import { installCli, uninstallCli, isCliInstalled } from '../cli-manager';

export const setupCliBridge = (): void => {
  // Check if CLI is installed
  ipcMain.handle('cli:isInstalled', async () => {
    return isCliInstalled();
  });

  // Install CLI
  ipcMain.handle('cli:install', async () => {
    return await installCli();
  });

  // Uninstall CLI
  ipcMain.handle('cli:uninstall', async () => {
    return await uninstallCli();
  });
};
