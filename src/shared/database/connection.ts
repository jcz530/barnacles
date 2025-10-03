import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { app } from 'electron';
import path from 'node:path';
import * as schema from './schema';

// Get the proper database path for production or development
function getDatabasePath(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // Check if we're in a packaged app
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
}

const client = createClient({
  url: getDatabasePath(),
});

export const db = drizzle(client, { schema });

export type DB = typeof db;
