import { db } from './connection';
import path from 'path';
import { app } from 'electron';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

export async function runMigrations(): Promise<void> {
  // Check if we're in a packaged app
  const isPackaged = app.isPackaged;

  const migrationsFolder = isPackaged
    ? path.join(process.resourcesPath, 'migrations')
    : path.join(process.cwd(), 'migrations');

  try {
    console.log('🔧 Running database migrations from:', migrationsFolder);
    await migrate(db, { migrationsFolder });
    console.log('✨ Migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Attempted migrations path:', migrationsFolder);
    throw error;
  }
}
