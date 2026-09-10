import { ipcMain } from 'electron';
import { getShortcutStatus, hideCommandPalette, setPaletteDepth } from '../command-palette-manager';

export const setupCommandPaletteBridge = (): void => {
  // The floating window hides rather than closes: window.close() would destroy
  // the renderer and make the next hotkey press pay a cold start.
  ipcMain.on('command-palette:close', () => {
    hideCommandPalette();
  });

  // How deep the palette's action stack is. Escape has to mean "go back" while
  // the person is inside an item's actions, and only close the window at the
  // root -- but the main process is what sees Escape first, so it needs to know.
  ipcMain.on('command-palette:depth', (_event, depth: number) => {
    setPaletteDepth(typeof depth === 'number' ? depth : 0);
  });

  ipcMain.handle('command-palette:shortcut-status', () => getShortcutStatus());
};
