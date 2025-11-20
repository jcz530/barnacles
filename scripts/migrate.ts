import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'path';
import * as schema from '../src/shared/database/schema';

async function main(): Promise<void> {
  try {
    // Create a standalone database connection for migration script
    const dbPath = './database.db';
    const sqlite = new Database(dbPath);

    // Enable WAL mode for better concurrency
    sqlite.pragma('journal_mode = WAL');

    const db = drizzle(sqlite, { schema });

    // Run migrations from project root
    const migrationsPath = path.join(process.cwd(), 'migrations');

    console.log('Running migrations...');
    console.log('Database:', dbPath);
    console.log('Migrations path:', migrationsPath);

    await migrate(db, { migrationsFolder: migrationsPath });

    console.log('Migration script completed successfully');
    sqlite.close();
    process.exit(0);
  } catch (error) {
    console.error('Migration script failed:', error);
    process.exit(1);
  }
}

main();