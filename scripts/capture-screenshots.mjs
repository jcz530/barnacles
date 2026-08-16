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

/**
 * Seed the UI state the app reads during startup, then reload so it takes effect.
 *
 * Values are written as bare strings, matching what the app itself persists —
 * VueUse's useDark and useLocalStorage store `dark` / `card`, not JSON-quoted
 * `"dark"`. A JSON-quoted value fails to parse and silently falls back to the
 * default, which is why theme and view mode appeared to be ignored.
 *
 * localStorage is cleared first so a shot never inherits state from the one
 * before it.
 */
async function seedUiState(win, entries) {
  const sets = Object.entries(entries)
    .map(([key, value]) => `localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)});`)
    .join('\n');

  await win.webContents.executeJavaScript(`localStorage.clear();\n${sets}`);
}

/**
 * Force the requested theme after the app has mounted.
 *
 * `useDark` initialises from the OS colour scheme when it cannot resolve a
 * stored preference, so on a machine set to dark every "light" shot came out
 * dark regardless of localStorage. Toggling through the app's own theme button
 * drives useDark itself, which keeps the class, the storage value, and the
 * inverted palette consistent.
 */
/**
 * Force the projects list into a given view mode after the app has mounted.
 *
 * Seeding localStorage alone is not enough: the app rewrites the key during
 * boot, so a seeded "card" was overwritten with the default "table". Clicking
 * the app's own ViewToggle drives the same state the user would.
 */
async function forceProjectsView(win, view) {
  return win.webContents.executeJavaScript(`
    (async () => {
      const sleep = ms => new Promise(r => setTimeout(r, ms));
      const group = document.querySelector('[role="group"]');
      if (!group) return false;

      const buttons = group.querySelectorAll('button');
      if (buttons.length < 2) return false;

      // ViewToggle renders the table button first, the card button second.
      const target = ${JSON.stringify(view)} === 'card' ? buttons[1] : buttons[0];
      target.click();
      await sleep(250);
      return localStorage.getItem('projects-view-mode') === ${JSON.stringify(view)};
    })();
  `);
}

async function forceTheme(win, theme) {
  return win.webContents.executeJavaScript(`
    (async () => {
      const root = document.documentElement;
      const wanted = ${JSON.stringify(theme)};
      const sleep = ms => new Promise(r => setTimeout(r, ms));

      // The toggle cycles light -> dark -> auto; click until the class matches.
      for (let i = 0; i < 4; i++) {
        if (root.classList.contains(wanted)) return true;
        const button = [...document.querySelectorAll('button')]
          .find(b => /^(Light|Dark|Auto)$/.test(b.textContent.trim()));
        if (!button) return false;
        button.click();
        await sleep(150);
      }
      return root.classList.contains(wanted);
    })();
  `);
}

/**
 * Confirm the requested theme actually reached the DOM.
 *
 * `useDark` writes the theme onto <html> as a class, and the dark variant is
 * defined as `.dark *`, so the class is the authoritative signal that the
 * inverted palette is live.
 */
async function uiStateApplied(win, theme, timeoutMs = 3000) {
  // useDark applies the class after the app mounts, which can land slightly
  // after the data has settled — so poll rather than checking once.
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const className = await win.webContents.executeJavaScript(
      'document.documentElement.className'
    );
    if (String(className).split(/\s+/).includes(theme)) return true;
    await sleep(100);
  }
  return false;
}

async function capture(win, shot, theme, outputFileName) {
  const target = rendererUrl(shot.route);

  const state = { 'vueuse-color-scheme': theme, ...(shot.storage ?? {}) };

  await seedUiState(win, state);
  await win.loadURL(target);
  await waitForData(win);

  await forceTheme(win, theme);

  // Fail loudly rather than writing a shot in the wrong theme: a silently
  // mis-themed screenshot is easy to publish without noticing.
  if (!(await uiStateApplied(win, theme))) {
    throw new Error(`theme "${theme}" did not apply`);
  }

  const wantedView = shot.storage?.['projects-view-mode'];
  if (wantedView && !(await forceProjectsView(win, wantedView))) {
    throw new Error(`projects view "${wantedView}" did not apply`);
  }

  // Runs after the data has landed: scrolling or clicking into rendered UI,
  // as opposed to `prepare`, which seeds state the app reads during startup.
  if (shot.afterLoad) {
    await win.webContents.executeJavaScript(shot.afterLoad);
  }

  await sleep(shot.settleMs ?? PAINT_SETTLE_MS);

  const image = await win.webContents.capturePage();
  const file = path.join(OUT_DIR, outputFileName(shot, theme));
  await writeFile(file, image.toPNG());

  const { width, height } = image.getSize();
  return { file, width, height };
}

async function main() {
  // Imported inside main(): a top-level await in an Electron ESM entry can stall
  // before app.whenReady() ever fires.
  const { SHOTS, THEMES, outputFileName } = await import(
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

  for (const theme of THEMES) {
    for (const shot of shots) {
      try {
        const result = await capture(win, shot, theme, outputFileName);
        captured.push({ shot: shot.name, theme, ...result });
        console.log(`  ✓ ${outputFileName(shot, theme)} (${result.width}x${result.height})`);
      } catch (error) {
        failed.push({ shot: shot.name, theme, error: String(error) });
        console.error(`  ✗ ${outputFileName(shot, theme)}: ${error}`);
      }
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
