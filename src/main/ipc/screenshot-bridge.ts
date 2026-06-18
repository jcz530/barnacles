import { BrowserWindow, ipcMain } from 'electron';
import { upsert } from '../../backend/services/port-screenshot-cache-service';

const MAX_CONCURRENT = 3;
let activeCaptures = 0;
const captureQueue: Array<() => void> = [];

const CAPTURE_WIDTH = 640;
const CAPTURE_HEIGHT = 400;
const THUMBNAIL_WIDTH = 384;
const THUMBNAIL_HEIGHT = 240;
const JPEG_QUALITY = 65;

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

interface CaptureRequest {
  url: string;
  port: number;
  processName: string;
  signature: string | null;
}

export const setupScreenshotBridge = (): void => {
  ipcMain.handle('screenshot:capture-url', async (_event, request: CaptureRequest) => {
    const { url, port, processName, signature } = request;

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return { success: false, error: 'Invalid URL: must start with http:// or https://' };
    }

    await acquireSlot();

    const win = new BrowserWindow({
      width: CAPTURE_WIDTH,
      height: CAPTURE_HEIGHT,
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
      const thumbnail = image.resize({ width: THUMBNAIL_WIDTH, height: THUMBNAIL_HEIGHT });
      const jpegBuffer = thumbnail.toJPEG(JPEG_QUALITY);

      const cached = await upsert({
        port,
        processName,
        signature,
        jpegBuffer,
        width: THUMBNAIL_WIDTH,
        height: THUMBNAIL_HEIGHT,
      });

      return { success: true, data: { fileName: cached.fileName, capturedAt: cached.capturedAt } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
      win.destroy();
      releaseSlot();
    }
  });
};
