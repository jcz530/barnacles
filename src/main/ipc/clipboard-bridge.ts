import { ipcMain, clipboard, nativeImage } from 'electron';

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

  // Puts a real image on the clipboard, so it can be pasted straight into a
  // social composer rather than pasted as a file reference.
  ipcMain.handle('clipboard:write-image', async (_, png: Uint8Array) => {
    try {
      const image = nativeImage.createFromBuffer(Buffer.from(png));
      if (image.isEmpty()) return { success: false, error: 'Image could not be read' };
      clipboard.writeImage(image);
      return { success: true };
    } catch (error) {
      console.error('Failed to write image to clipboard:', error);
      return { success: false, error: String(error) };
    }
  });

  ipcMain.handle('clipboard:write-text', async (_, text: string) => {
    try {
      clipboard.writeText(text);
      return { success: true };
    } catch (error) {
      console.error('Failed to write text to clipboard:', error);
      return { success: false, error: String(error) };
    }
  });
};
