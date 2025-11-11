import { app, BrowserWindow, ipcMain } from 'electron';
import { createMenu } from '../menu';
import { createAppWindow } from '../main';

/**
 * Helper to filter out utility windows (like tray popup) and return only main app windows
 */
const getMainWindows = (): BrowserWindow[] => {
  return BrowserWindow.getAllWindows().filter(
    win => !win.isDestroyed() && !win.skipTaskbar && win.isResizable() && !win.isAlwaysOnTop()
  );
};

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

  // Handle showing existing window or creating one if none exist
  ipcMain.handle('show-or-create-window', async () => {
    try {
      const mainWindows = getMainWindows();

      // If there's an existing main window, show and focus it
      if (mainWindows.length > 0) {
        const existingWindow = mainWindows[0];
        if (!existingWindow.isVisible()) {
          existingWindow.show();
        }
        existingWindow.focus();
        return { success: true, windowId: existingWindow.id, wasExisting: true };
      }

      // No existing window, create a new one
      const newWindow = await createAppWindow();
      return { success: true, windowId: newWindow.id, wasExisting: false };
    } catch (error) {
      console.error('Failed to show or create window:', error);
      return { success: false, error: String(error) };
    }
  });

  // Handle creating a new window (always creates a new one)
  ipcMain.handle('create-new-window', async () => {
    try {
      const newWindow = await createAppWindow();
      return { success: true, windowId: newWindow.id };
    } catch (error) {
      console.error('Failed to create new window:', error);
      return { success: false, error: String(error) };
    }
  });

  // Handle navigating to a project in the main window
  ipcMain.handle('navigate-to-project', async (_, projectId: string) => {
    try {
      const mainWindows = getMainWindows();

      if (mainWindows.length > 0) {
        const targetWindow = mainWindows[0];
        // Send navigation command to the renderer
        targetWindow.webContents.send('navigate-to-project', projectId);
        return { success: true };
      }

      return { success: false, error: 'No main window found' };
    } catch (error) {
      console.error('Failed to navigate to project:', error);
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
