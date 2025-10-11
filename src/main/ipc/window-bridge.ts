import { BrowserWindow, ipcMain } from 'electron';
import { createMenu } from '../menu';

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
};
