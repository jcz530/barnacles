import { app, BrowserWindow, ipcMain } from 'electron';
import { createMenu } from '../menu';
import { createAppWindow } from '../main';
import { getMainWindows } from '../window-utils';

/**
 * Resolve once a window's renderer has loaded, so a message sent straight after
 * creating it isn't dropped before anything is listening.
 */
const waitForRenderer = async (window: BrowserWindow): Promise<void> => {
  if (!window.webContents.isLoading()) return;
  await new Promise<void>(resolve => {
    window.webContents.once('did-finish-load', () => resolve());
  });
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

      // No existing window, create a new one. Wait for the renderer to finish
      // loading: createAppWindow resolves as soon as the window object exists,
      // and a navigate-to-project sent before then lands with nothing listening.
      const newWindow = await createAppWindow();
      await waitForRenderer(newWindow);
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

  // Handle navigating to a route path in the main window (e.g. "/projects/123/accounts")
  ipcMain.handle('navigate-to-project', async (_, path: string) => {
    try {
      const mainWindows = getMainWindows();

      // Create one when every window is closed rather than failing: the tray
      // popup and the floating command palette both navigate from a state where
      // there may be no window at all.
      const targetWindow = mainWindows[0] ?? (await createAppWindow());
      await waitForRenderer(targetWindow);

      if (!targetWindow.isVisible()) {
        targetWindow.show();
      }
      targetWindow.focus();
      // Send navigation command to the renderer
      targetWindow.webContents.send('navigate-to-project', path);
      return { success: true };
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
