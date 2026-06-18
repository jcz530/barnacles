import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'node:path';
import os from 'os';
import { mkdirSync } from 'node:fs';
import * as schema from './schema';

// Standard user data location for all contexts (Electron and CLI)
export function getAppDataDir(): string {
  if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
    const tmpPath = path.join(os.tmpdir(), 'barnacles-test');
    mkdirSync(tmpPath, { recursive: true });
    return tmpPath;
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

// Get the standard database path for both Electron and CLI contexts
function getDatabasePath(): string {
  // Use in-memory database for tests
  if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
    return ':memory:';
  }

  // Use development database if not in production
  if (process.env.NODE_ENV === 'development') {
    return './database.db';
  }

  return path.join(getAppDataDir(), 'database.db');
}

const dbPath = getDatabasePath();
const sqlite = new Database(dbPath);

// Enable WAL mode for better concurrency
if (dbPath !== ':memory:') {
  sqlite.pragma('journal_mode = WAL');
}

export const db = drizzle(sqlite, { schema });

export type DB = typeof db;
