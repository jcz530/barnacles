import { BrowserWindow, dialog, ipcMain } from 'electron';
import { writeFile } from 'node:fs/promises';

/**
 * Renders a self-contained HTML document to a PNG for the stats share card.
 *
 * The renderer builds the entire document — theme colors, layout, inlined
 * assets — and this bridge only rasterizes it. Nothing here knows about stats,
 * so the capture page loads no app code, has no preload, and cannot reach any
 * other bridge.
 *
 * Three behaviors below are not obvious and were established by probing
 * Electron directly in this repo; see the notes on each.
 */

/** Guards against the channel being used to rasterize arbitrary huge pages. */
const MAX_HTML_BYTES = 8 * 1024 * 1024;
const LOAD_TIMEOUT_MS = 5000;
/** Matches the settle used by scripts/capture-screenshots.mjs. */
const PAINT_SETTLE_MS = 200;
/** Tear the window down once sharing has clearly finished. */
const IDLE_TEARDOWN_MS = 60_000;

interface RenderRequest {
  html: string;
  /** CSS pixel size to lay out at. */
  width: number;
  height: number;
  /** Exact pixel size the returned PNG must have. */
  outputWidth: number;
  outputHeight: number;
}

interface SaveRequest {
  png: Uint8Array;
  suggestedName: string;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * A single reusable capture window.
 *
 * Reuse is required for correctness, not just speed: creating a *second*
 * BrowserWindow for capture reliably fails to load (ERR_FAILED) and takes the
 * process down with SIGTRAP. One long-lived window handles every capture.
 */
let captureWindow: BrowserWindow | null = null;
let teardownTimer: NodeJS.Timeout | null = null;

/** Serializes captures; concurrent loads into one window would race. */
let queue: Promise<unknown> = Promise.resolve();

function getCaptureWindow(): BrowserWindow {
  if (captureWindow && !captureWindow.isDestroyed()) return captureWindow;

  captureWindow = new BrowserWindow({
    width: 100,
    height: 100,
    show: false,
    frame: false,
    // Transparent so a card with rounded corners composites cleanly.
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      // Deliberately no preload: the capture page gets no bridge access.
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  return captureWindow;
}

function scheduleTeardown(): void {
  if (teardownTimer) clearTimeout(teardownTimer);
  teardownTimer = setTimeout(() => {
    if (captureWindow && !captureWindow.isDestroyed()) captureWindow.destroy();
    captureWindow = null;
    teardownTimer = null;
  }, IDLE_TEARDOWN_MS);
}

/** Run `task` after any in-flight capture, whether it succeeded or not. */
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run: Promise<T> = queue.then(
    () => task(),
    () => task()
  );
  queue = run.catch((): void => undefined);
  return run;
}

async function renderToPng(request: RenderRequest): Promise<Buffer> {
  const { html, width, height, outputWidth, outputHeight } = request;
  const win = getCaptureWindow();

  win.setContentSize(Math.round(width), Math.round(height));

  const url = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
  await Promise.race([
    win.loadURL(url),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Timed out rendering the share card')), LOAD_TIMEOUT_MS)
    ),
  ]);

  // Webfonts are the documented failure mode for captures at this size, so wait
  // for them before painting rather than relying on the settle alone.
  await win.webContents
    .executeJavaScript('document.fonts ? document.fonts.ready.then(() => true) : true')
    .catch((): void => undefined);
  await sleep(PAINT_SETTLE_MS);

  let image = await win.webContents.capturePage();

  // capturePage() inherits the display's device pixel ratio, so the raw capture
  // is larger on a retina screen than on a 1x one. Normalize so every user gets
  // a byte-identical size.
  const size = image.getSize();
  if (size.width !== outputWidth || size.height !== outputHeight) {
    image = image.resize({ width: outputWidth, height: outputHeight, quality: 'best' });
  }

  return image.toPNG();
}

export const setupShareCardBridge = (): void => {
  ipcMain.handle('share-card:render', async (_event, request: RenderRequest) => {
    if (typeof request?.html !== 'string' || request.html.length === 0) {
      return { success: false, error: 'No card markup was provided' };
    }
    if (request.html.length > MAX_HTML_BYTES) {
      return { success: false, error: 'Card markup is too large to render' };
    }

    try {
      const png = await enqueue(() => renderToPng(request));
      return {
        success: true,
        data: {
          png: new Uint8Array(png),
          width: request.outputWidth,
          height: request.outputHeight,
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    } finally {
      scheduleTeardown();
    }
  });

  ipcMain.handle('share-card:save', async (_event, request: SaveRequest) => {
    try {
      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: request.suggestedName,
        filters: [{ name: 'PNG Image', extensions: ['png'] }],
      });

      if (canceled || !filePath) return { success: false, canceled: true };

      await writeFile(filePath, Buffer.from(request.png));
      return { success: true, data: filePath };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
};
