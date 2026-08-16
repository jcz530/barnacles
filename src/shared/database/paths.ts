import path from 'node:path';
import os from 'os';
import { mkdirSync } from 'node:fs';

/**
 * Directory name used for the disposable demo profile. Demo seeding refuses to
 * run against a database outside a directory with this name, so it is the
 * safety boundary between fake data and the user's real database.
 */
export const DEMO_DATA_DIRNAME = '.demo-data';

function isTestEnv(env: NodeJS.ProcessEnv): boolean {
  return env.NODE_ENV === 'test' || env.VITEST === 'true';
}

/**
 * Resolve the directory holding the database and file-backed caches.
 *
 * Precedence (order matters):
 *   1. test          -> a pid-namespaced tmp dir
 *   2. BARNACLES_DATA_DIR -> explicit override (demo mode, screenshot capture)
 *   3. platform default app-data dir
 *
 * The override is honoured here as well as in `getDatabasePath` so that caches
 * such as the port screenshot cache follow the profile instead of writing into
 * the user's real app-data directory.
 */
export function getAppDataDir(env: NodeJS.ProcessEnv = process.env): string {
  if (isTestEnv(env)) {
    // Namespaced by pid so parallel vitest worker processes don't share (and race
    // on) the same on-disk directory for file-backed caches like screenshots.
    const tmpPath = path.join(os.tmpdir(), `barnacles-test-${process.pid}`);
    mkdirSync(tmpPath, { recursive: true });
    return tmpPath;
  }

  if (env.BARNACLES_DATA_DIR) {
    const overridePath = path.resolve(env.BARNACLES_DATA_DIR);
    mkdirSync(overridePath, { recursive: true });
    return overridePath;
  }

  const homeDir = os.homedir();
  let userDataPath: string;

  if (process.platform === 'darwin') {
    userDataPath = path.join(homeDir, 'Library', 'Application Support', 'Barnacles');
  } else if (process.platform === 'win32') {
    userDataPath = path.join(homeDir, 'AppData', 'Roaming', 'Barnacles');
  } else {
    // Linux
    userDataPath = path.join(homeDir, '.config', 'Barnacles');
  }

  mkdirSync(userDataPath, { recursive: true });

  return userDataPath;
}

/**
 * Resolve the database path for both Electron and CLI contexts.
 *
 * BARNACLES_DATA_DIR is checked *before* the NODE_ENV=development branch. That
 * ordering is load-bearing: development otherwise resolves to ./database.db,
 * the real dev database, and demo mode must never open it.
 */
export function getDatabasePath(env: NodeJS.ProcessEnv = process.env): string {
  // Use in-memory database for tests
  if (isTestEnv(env)) {
    return ':memory:';
  }

  if (env.BARNACLES_DATA_DIR) {
    return path.join(getAppDataDir(env), 'database.db');
  }

  // Use development database if not in production
  if (env.NODE_ENV === 'development') {
    return './database.db';
  }

  return path.join(getAppDataDir(env), 'database.db');
}
