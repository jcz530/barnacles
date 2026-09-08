import { ipcMain } from 'electron';
import { getShortcutStatus, hideCommandPalette } from '../command-palette-manager';

export const setupCommandPaletteBridge = (): void => {
  // The floating window hides rather than closes: window.close() would destroy
  // the renderer and make the next hotkey press pay a cold start.
  ipcMain.on('command-palette:close', () => {
    hideCommandPalette();
  });

  ipcMain.handle('command-palette:shortcut-status', () => getShortcutStatus());
};
