/**
 * Electron entry that captures one PNG per manifest shot per theme.
 *
 * Run via `npm run screenshots`, which builds the app and sets the demo
 * environment before Electron boots (the database singleton reads
 * BARNACLES_DATA_DIR at import time, so it must already be set).
 *
 * Uses a normal BrowserWindow with show:false rather than an offscreen one:
 * offscreen rendering disables GPU compositing paths, which is fine for the
 * 384px port thumbnails in src/main/ipc/screenshot-bridge.ts but tends to
 * produce blank canvases and missing fonts at the 2x sizes published here.
 */
import { app, BrowserWindow, ipcMain } from 'electron';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const OUT_DIR = path.join(repoRoot, 'screenshots/out');
const WIDTH = 1200;
const HEIGHT = 800;
const SCALE = 2;
const IDLE_SETTLE_MS = 400;
const READY_TIMEOUT_MS = 15_000;
const PAINT_SETTLE_MS = 250;

// 2x output that does not depend on the capturing machine's display.
app.commandLine.appendSwitch('force-device-scale-factor', String(SCALE));

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Wait for TanStack Query to go idle and stay idle briefly.
 *
 * A single isFetching===0 check passes in the gap before a dependent query
 * starts, so require the idle state to hold for IDLE_SETTLE_MS.
 */
async function waitForData(win) {
  const started = Date.now();
  let quietSince = 0;

  while (Date.now() - started < READY_TIMEOUT_MS) {
    let busy = 0;
    try {
      busy = await win.webContents.executeJavaScript(
        'window.__bqIsFetching ? window.__bqIsFetching() : 0'
      );
    } catch {
      busy = 0; // mid-navigation; treat as idle and let the settle window re-check
    }

    if (busy === 0) {
      if (!quietSince) quietSince = Date.now();
      if (Date.now() - quietSince >= IDLE_SETTLE_MS) return true;
    } else {
      quietSince = 0;
    }

    await sleep(50);
  }

  return false;
}

function rendererUrl(hashRoute) {
  const indexPath = path.join(repoRoot, 'dist/renderer/index.html');
  const url = pathToFileURL(indexPath);
  // ?screenshots=1 turns on the readiness hook in src/frontend/main.ts.
  url.search = 'screenshots=1';
  url.hash = hashRoute || '/';
  return url.href;
}

async function capture(win, shot, outputFileName) {
  const target = rendererUrl(shot.route);

  // A shot's prepare step writes localStorage (e.g. view mode), which the app
  // reads during startup — so it must run before the load that gets captured,
  // not after. Every shot reloads, so no shot inherits the previous one's state.
  if (shot.prepare) {
    await win.webContents.executeJavaScript(shot.prepare);
  }
  await win.loadURL(target);

  await waitForData(win);

  // Runs after the data has landed: scrolling or clicking into rendered UI,
  // as opposed to `prepare`, which seeds state the app reads during startup.
  if (shot.afterLoad) {
    await win.webContents.executeJavaScript(shot.afterLoad);
  }

  await sleep(shot.settleMs ?? PAINT_SETTLE_MS);

  const image = await win.webContents.capturePage();
  const file = path.join(OUT_DIR, outputFileName(shot));
  await writeFile(file, image.toPNG());

  const { width, height } = image.getSize();
  return { file, width, height };
}

async function main() {
  // Imported inside main(): a top-level await in an Electron ESM entry can stall
  // before app.whenReady() ever fires.
  const { SHOTS, outputFileName } = await import(
    pathToFileURL(path.join(repoRoot, 'screenshots/manifest.mjs')).href
  );

  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  // Start from a clean profile so captures never inherit state from a previous
  // run. Guarded on the directory name, since this is an rm -rf.
  const profile = process.env.BARNACLES_DATA_DIR;
  if (profile && path.basename(profile) === '.demo-data' && path.isAbsolute(profile)) {
    await rm(profile, { recursive: true, force: true });
  }

  // Starts the API and registers the IPC bridges the renderer fetches through.
  // dist/main/main.js is deliberately not imported: it takes the single-instance
  // lock and boots the tray, menus, and the real app window.
  const { startScreenshotHost } = await import(
    pathToFileURL(path.join(repoRoot, 'dist/screenshots/server.js')).href
  );
  const { port } = await startScreenshotHost();
  console.log(`🔌 API listening on port ${port}`);

  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    show: false,
    webPreferences: {
      preload: path.join(repoRoot, 'dist/preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    trafficLightPosition: process.platform === 'darwin' ? { x: 10, y: 10 } : undefined,
    frame: process.platform !== 'darwin',
  });

  const captured = [];
  const failed = [];
  const shots = SHOTS.filter(s => !s.manual);
  const manual = SHOTS.filter(s => s.manual);

  // Warm the app once so the first capture isn't racing initial boot.
  await win.loadURL(rendererUrl('/'));
  await waitForData(win);

  for (const shot of shots) {
    try {
      const result = await capture(win, shot, outputFileName);
      captured.push({ shot: shot.name, ...result });
      console.log(`  ✓ ${outputFileName(shot)} (${result.width}x${result.height})`);
    } catch (error) {
      failed.push({ shot: shot.name, error: String(error) });
      console.error(`  ✗ ${outputFileName(shot)}: ${error}`);
    }
  }

  console.log(`\n📸 Captured ${captured.length} screenshot(s) to screenshots/out`);
  if (manual.length) {
    console.log(
      `✋ Manual shot(s) skipped: ${manual.map(s => s.name).join(', ')} — capture by hand.`
    );
  }
  if (failed.length) {
    console.error(`❌ ${failed.length} shot(s) failed`);
  }

  win.destroy();
  app.exit(failed.length ? 1 : 0);
}

app.whenReady().then(main).catch(error => {
  console.error('Screenshot capture failed:', error);
  app.exit(1);
});
