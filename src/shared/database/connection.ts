import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import path from 'node:path';
import os from 'os';
import * as schema from './schema';

// Get the standard database path for both Electron and CLI contexts
function getDatabasePath(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // Use development database if not in production
  if (process.env.NODE_ENV === 'development') {
    return 'file:./database.db';
  }

  // Standard user data location for all contexts
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
