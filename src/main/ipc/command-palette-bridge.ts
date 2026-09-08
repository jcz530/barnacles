import { ipcMain } from 'electron';
import {
  getShortcutStatus,
  hideCommandPalette,
  toggleCommandPalette,
} from '../command-palette-manager';

export const setupCommandPaletteBridge = (): void => {
  ipcMain.on('command-palette:toggle', () => {
    void toggleCommandPalette();
  });

  // The floating window hides rather than closes: window.close() would destroy
  // the renderer and make the next hotkey press pay a cold start.
  ipcMain.on('command-palette:close', () => {
    hideCommandPalette();
  });

  ipcMain.handle('command-palette:shortcut-status', () => getShortcutStatus());
};
