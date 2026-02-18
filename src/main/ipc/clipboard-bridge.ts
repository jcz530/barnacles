import { ipcMain, clipboard } from 'electron';

export const setupClipboardBridge = (): void => {
  // Handler for copying a file path to clipboard so it can be pasted in Finder/Explorer
  ipcMain.handle('clipboard:write-file', async (_, filePath: string) => {
    try {
      // Write file path to clipboard in a format that file managers understand
      // macOS uses UTI (public.file-url), Linux uses MIME type (text/uri-list)
      const fileUrl = `file://${filePath}`;
      const mimeType = process.platform === 'linux' ? 'text/uri-list' : 'public.file-url';
      clipboard.writeBuffer(mimeType, Buffer.from(fileUrl));
      return { success: true };
    } catch (error) {
      console.error('Failed to write file to clipboard:', error);
      return { success: false, error: String(error) };
    }
  });
};
