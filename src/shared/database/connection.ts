import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { getAppDataDir, getDatabasePath } from './paths';

// Re-exported so existing consumers (e.g. port-screenshot-cache-service) keep
// importing it from here; the implementation lives in ./paths for testability.
export { getAppDataDir };

const dbPath = getDatabasePath();
const sqlite = new Database(dbPath);

/**
 * The database path this process actually opened. Demo seeding asserts on this
 * before writing anything, so it must reflect the resolved path rather than
 * re-deriving it from the environment.
 */
export function getResolvedDatabasePath(): string {
  return dbPath;
}

// Enable WAL mode for better concurrency
if (dbPath !== ':memory:') {
  sqlite.pragma('journal_mode = WAL');
}

export const db = drizzle(sqlite, { schema });

export type DB = typeof db;
