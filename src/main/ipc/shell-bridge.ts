import { ipcMain, shell } from 'electron';

export const setupShellBridge = (): void => {
  // Handler for opening paths in the file system
  ipcMain.handle('shell:open-path', async (_, path: string) => {
    return await shell.openPath(path);
  });

  // Handler for opening external URLs
  ipcMain.handle('shell:open-external', async (_, url: string) => {
    await shell.openExternal(url);
  });
};
