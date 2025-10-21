import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import path from 'node:path';
import os from 'os';
import * as schema from './schema';

// Detect if we're running in Electron context
function isElectronContext(): boolean {
  return typeof process !== 'undefined' && process.versions && 'electron' in process.versions;
}

// Get the proper database path for production or development
function getDatabasePath(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  if (isElectronContext()) {
    // In Electron context, try to require electron synchronously
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { app } = require('electron');
      const isPackaged = app.isPackaged;

      if (isPackaged) {
        // In packaged app, use the userData directory
        const userDataPath = app.getPath('userData');
        const dbPath = path.join(userDataPath, 'database.db');
        return `file:${dbPath}`;
      } else {
        // In development or when running from dist, use the project root
        return 'file:./database.db';
      }
    } catch {
      // If electron fails to load, fall through to CLI path
    }
  }

  // CLI context - use the same location as Electron's userData would be
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

  const dbPath = path.join(userDataPath, 'database.db');
  return `file:${dbPath}`;
}

const client = createClient({
  url: getDatabasePath(),
});

export const db = drizzle(client, { schema });

export type DB = typeof db;
