import { BrowserWindow, ipcMain } from 'electron';
import { closeFindOverlay, toggleFindOverlay } from '../find-overlay-manager';

export interface FindInPageOptions {
  forward?: boolean;
  findNext?: boolean;
  matchCase?: boolean;
  wordStart?: boolean;
  medialCapitalAsWordStart?: boolean;
}

export interface FindResult {
  requestId: number;
  activeMatchOrdinal: number;
  matches: number;
  selectionArea: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  finalUpdate: boolean;
}

/**
 * Gets the target (parent) window for find operations.
 * If the sender is a child overlay window, returns its parent.
 * Otherwise returns the sender's own window.
 */
const getTargetWindow = (senderWindow: BrowserWindow | null): BrowserWindow | null => {
  if (!senderWindow) return null;
  return senderWindow.getParentWindow() || senderWindow;
};

export const setupFindBridge = (): void => {
  // Start find in page - targets parent window's webContents
  ipcMain.handle('find:start', async (event, searchText: string, options?: FindInPageOptions) => {
    try {
      const senderWindow = BrowserWindow.fromWebContents(event.sender);
      const targetWindow = getTargetWindow(senderWindow);
      if (!targetWindow) {
        return { success: false, error: 'Window not found' };
      }

      const requestId = targetWindow.webContents.findInPage(searchText, options);
      return { success: true, requestId };
    } catch (error) {
      console.error('Failed to start find in page:', error);
      return { success: false, error: String(error) };
    }
  });

  // Stop find in page - targets parent window's webContents
  ipcMain.handle(
    'find:stop',
    async (event, action: 'clearSelection' | 'keepSelection' | 'activateSelection') => {
      try {
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        const targetWindow = getTargetWindow(senderWindow);
        if (!targetWindow) {
          return { success: false, error: 'Window not found' };
        }

        targetWindow.webContents.stopFindInPage(action);
        return { success: true };
      } catch (error) {
        console.error('Failed to stop find in page:', error);
        return { success: false, error: String(error) };
      }
    }
  );

  // Listen for find results on the parent window and forward to the overlay (sender)
  ipcMain.on('find:setup-listener', event => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    const targetWindow = getTargetWindow(senderWindow);
    if (!targetWindow) return;

    // Remove any existing listener to prevent duplicates
    targetWindow.webContents.removeAllListeners('found-in-page');

    // Set up new listener - forward results to the overlay (sender), not the target
    targetWindow.webContents.on('found-in-page', (_, result: FindResult) => {
      // Send results back to the sender (overlay window)
      if (!event.sender.isDestroyed()) {
        event.sender.send('find:result', result);
      }
    });
  });

  // Close overlay - hides the overlay, stops find, returns focus to parent
  ipcMain.on('find:close', event => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    const targetWindow = getTargetWindow(senderWindow);
    if (targetWindow) {
      closeFindOverlay(targetWindow);
    }
  });

  // Toggle overlay - used by menu and main window
  ipcMain.on('find:toggle', event => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    const targetWindow = getTargetWindow(senderWindow);
    if (targetWindow) {
      toggleFindOverlay(targetWindow);
    }
  });
};
