import { app, BrowserWindow, ipcMain } from 'electron';
import { createMenu } from '../menu';
import { createAppWindow } from '../main';

export const setupWindowBridge = (): void => {
  // Handle window title updates from renderer
  ipcMain.on('update-window-title', (event, title: string) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      window.setTitle(title);
      // Rebuild menu to update window list with new title
      createMenu();
    }
  });

  // Handle creating a new window
  ipcMain.handle('create-new-window', async () => {
    try {
      const newWindow = await createAppWindow();
      return { success: true, windowId: newWindow.id };
    } catch (error) {
      console.error('Failed to create new window:', error);
      return { success: false, error: String(error) };
    }
  });

  // Handle quitting the application
  ipcMain.handle('quit-app', async () => {
    try {
      app.quit();
      return { success: true };
    } catch (error) {
      console.error('Failed to quit app:', error);
      return { success: false, error: String(error) };
    }
  });
};
