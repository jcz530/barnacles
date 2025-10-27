import { ipcMain, clipboard } from 'electron';

export const setupClipboardBridge = (): void => {
  // Handler for copying a file path to clipboard so it can be pasted in Finder/Explorer
  ipcMain.handle('clipboard:write-file', async (_, filePath: string) => {
    try {
      // Write file path to clipboard in a format that file managers understand
      // On macOS, this allows pasting the file in Finder
      clipboard.writeBuffer('public.file-url', Buffer.from(`file://${filePath}`));
      return { success: true };
    } catch (error) {
      console.error('Failed to write file to clipboard:', error);
      return { success: false, error: String(error) };
    }
  });
};
