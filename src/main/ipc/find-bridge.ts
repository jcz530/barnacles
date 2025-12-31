import { BrowserWindow, ipcMain } from 'electron';

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

export const setupFindBridge = (): void => {
  // Start find in page
  ipcMain.handle('find:start', async (event, searchText: string, options?: FindInPageOptions) => {
    try {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window) {
        return { success: false, error: 'Window not found' };
      }

      const requestId = window.webContents.findInPage(searchText, options);
      return { success: true, requestId };
    } catch (error) {
      console.error('Failed to start find in page:', error);
      return { success: false, error: String(error) };
    }
  });

  // Stop find in page
  ipcMain.handle(
    'find:stop',
    async (event, action: 'clearSelection' | 'keepSelection' | 'activateSelection') => {
      try {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (!window) {
          return { success: false, error: 'Window not found' };
        }

        window.webContents.stopFindInPage(action);
        return { success: true };
      } catch (error) {
        console.error('Failed to stop find in page:', error);
        return { success: false, error: String(error) };
      }
    }
  );

  // Listen for find results and forward to renderer
  // We set up a listener for each window's webContents
  ipcMain.on('find:setup-listener', event => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;

    // Remove any existing listener to prevent duplicates
    window.webContents.removeAllListeners('found-in-page');

    // Set up new listener
    window.webContents.on('found-in-page', (_, result: FindResult) => {
      // Send the result back to the renderer
      window.webContents.send('find:result', result);
    });
  });
};
