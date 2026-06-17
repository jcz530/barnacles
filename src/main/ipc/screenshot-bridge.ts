import { BrowserWindow, ipcMain } from 'electron';

const MAX_CONCURRENT = 3;
let activeCaptures = 0;
const captureQueue: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (activeCaptures < MAX_CONCURRENT) {
    activeCaptures++;
    return Promise.resolve();
  }
  return new Promise(resolve =>
    captureQueue.push(() => {
      activeCaptures++;
      resolve();
    })
  );
}

function releaseSlot(): void {
  const next = captureQueue.shift();
  if (next) {
    next();
  } else {
    activeCaptures--;
  }
}

export const setupScreenshotBridge = (): void => {
  ipcMain.handle('screenshot:capture-url', async (_event, url: string) => {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return { success: false, error: 'Invalid URL: must start with http:// or https://' };
    }

    await acquireSlot();

    const win = new BrowserWindow({
      width: 1280,
      height: 800,
      show: false,
      webPreferences: {
        offscreen: true,
        contextIsolation: true,
        nodeIntegration: false,
        javascript: true,
      },
    });

    try {
      // Start navigation; race page-load completion against an 8s timeout
      win.loadURL(url).catch(() => {});
      await Promise.race([
        new Promise<void>(resolve => win.webContents.once('did-finish-load', resolve)),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('Screenshot timeout')), 8000)
        ),
      ]);

      const image = await win.webContents.capturePage();
      const screenshot = image.toPNG().toString('base64');
      return { success: true, data: { screenshot } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
      win.destroy();
      releaseSlot();
    }
  });
};
