import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { isMac, getHomeDir } from '../../shared/utils/platform';

const execFileAsync = promisify(execFile);

/**
 * Extracts the real icon of an installed application so IDE and terminal rows
 * can show what the user actually launches rather than one generic glyph for
 * every editor.
 *
 * macOS only. Callers get null elsewhere and fall back to the glyph they
 * already render.
 *
 * Reads the bundle's own .icns with `sips` rather than Electron's
 * `app.getFileIcon`. getFileIcon is the obvious candidate and does not work
 * here: on macOS it returns one generic document icon for every bundle -- the
 * same 1181-byte image for VS Code, Xcode and Zed alike -- and asking it for
 * `size: 'large'` aborts the whole process with SIGTRAP, which no try/catch can
 * catch because it is a native assertion rather than a JS throw. `sips` ships
 * with macOS, needs no dependency, and yields each app's real artwork.
 */

/**
 * Where `.app` bundles live. `/System/Applications/Utilities` matters more than
 * it looks -- Terminal.app is only there, and it is the one terminal every mac
 * is guaranteed to have.
 */
function searchDirs(): string[] {
  const home = getHomeDir();
  return [
    '/Applications',
    path.join(home, 'Applications'),
    '/System/Applications',
    '/System/Applications/Utilities',
    path.join(home, 'Applications', 'JetBrains Toolbox'),
  ];
}

/**
 * Resolves the first of `bundleNames` that exists on disk.
 *
 * Takes a list rather than one name because the same IDE ships under several
 * bundle names -- "PyCharm.app" and "PyCharm Community Edition.app" are the
 * same entry in our definitions.
 */
export async function findAppBundle(bundleNames: string[]): Promise<string | null> {
  if (!isMac || bundleNames.length === 0) return null;

  for (const dir of searchDirs()) {
    for (const name of bundleNames) {
      const full = path.join(dir, name);
      try {
        await fs.access(full);
        return full;
      } catch {
        // Not here, keep looking.
      }
    }
  }
  return null;
}

/**
 * Cached PNG bytes keyed by bundle path.
 *
 * In-memory rather than on disk on purpose. Icon lookup measures ~1.3ms per app
 * warm, because macOS already maintains a system-wide icon cache that every app
 * shares -- a second cache on disk would buy nothing and would need an
 * invalidation story, which is where the staleness bugs live. A bundle's
 * directory mtime is *not* a usable signal for that: several apps update their
 * contents without touching it, so a mtime-keyed cache can pin a stale icon
 * indefinitely. Process lifetime is the honest scope; a relaunch re-reads.
 *
 * One consequence worth knowing rather than fixing: this lives in the main
 * process, so reloading the window does not clear it. An editor installed while
 * Barnacles is running is detected straight away -- detection does not consult
 * this cache -- but its icon stays a 404 until the app is restarted, because the
 * miss recorded before it existed is still here. The row falls back to its glyph
 * meanwhile, which is what it showed anyway.
 */
const cache = new Map<string, Promise<Buffer | null>>();

/**
 * Reads the icon of the app bundle at `bundlePath` as PNG bytes.
 *
 * Returns null when there is nothing sensible to draw -- not macOS, no bundle,
 * or an app whose icon does not resolve -- so every caller has exactly one
 * fallback path to handle.
 */
export async function getAppIconPng(bundlePath: string): Promise<Buffer | null> {
  if (!isMac) return null;

  // The in-flight promise is what gets cached, not the value it settles to.
  // Caching the value would leave a window between the miss and the write in
  // which every concurrent caller starts its own extraction: a dropdown renders
  // one <img> per installed tool and the browser fires them together, so a cold
  // open would spawn two child processes per tool instead of two in total.
  let inflight = cache.get(bundlePath);
  if (!inflight) {
    inflight = readIcon(bundlePath);
    cache.set(bundlePath, inflight);
  }

  // readIcon resolves to null rather than rejecting, so a cached promise can
  // never be a rejected one waiting to surface at an unrelated caller.
  return inflight;
}

/** Rendered size. 64px stays crisp in the 16-20px slots these draw in at 2x. */
const ICON_SIZE = 64;

/**
 * Locates a bundle's icon file.
 *
 * The name comes from CFBundleIconFile, which may or may not carry the .icns
 * extension -- Xcode says "Xcode", VS Code says "Code.icns" -- so the suffix is
 * normalised rather than assumed. Guessing the filename instead would be wrong
 * more often than it looks: VS Code's Resources folder holds about forty .icns
 * files, one per document type, and the app's own is not the first
 * alphabetically.
 */
async function findIcnsPath(bundlePath: string): Promise<string | null> {
  const plist = path.join(bundlePath, 'Contents', 'Info.plist');

  try {
    const { stdout } = await execFileAsync(
      '/usr/libexec/PlistBuddy',
      ['-c', 'Print :CFBundleIconFile', plist],
      { timeout: 5_000 }
    );

    const declared = stdout.trim();
    if (!declared) return null;

    const fileName = declared.toLowerCase().endsWith('.icns') ? declared : `${declared}.icns`;
    const iconPath = path.join(bundlePath, 'Contents', 'Resources', fileName);

    await fs.access(iconPath);
    return iconPath;
  } catch {
    // No Info.plist, no declared icon, or the declared file is missing.
    return null;
  }
}

async function readIcon(bundlePath: string): Promise<Buffer | null> {
  let tempDir: string | null = null;

  try {
    const icnsPath = await findIcnsPath(bundlePath);
    if (!icnsPath) return null;

    // sips writes to a file rather than stdout, so it needs somewhere to put
    // one. Kept out of the bundle, which we must never write into.
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'barnacles-icon-'));
    const outPath = path.join(tempDir, 'icon.png');

    await execFileAsync(
      '/usr/bin/sips',
      [
        '-s',
        'format',
        'png',
        '--resampleHeightWidthMax',
        String(ICON_SIZE),
        icnsPath,
        '--out',
        outPath,
      ],
      { timeout: 10_000 }
    );

    const png = await fs.readFile(outPath);
    return png.byteLength > 0 ? png : null;
  } catch {
    // An unreadable or malformed icon is an ordinary outcome, not an error
    // worth surfacing: the caller draws a glyph instead.
    return null;
  } finally {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}

/** Clears the icon cache. Exists for tests. */
export function clearAppIconCache(): void {
  cache.clear();
}
