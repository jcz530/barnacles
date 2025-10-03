import { migrate } from 'drizzle-orm/libsql/migrator';
import { db } from './connection';
import path from 'path';
import { app } from 'electron';

export async function runMigrations(): Promise<void> {
  let migrationsPath: string;

  // Check if we're in a packaged app
  const isPackaged = app.isPackaged;

  if (isPackaged) {
    // In packaged app, migrations are in the extraResources
    migrationsPath = path.join(process.resourcesPath, 'migrations');
  } else {
    // In development or when running from dist, use the project root
    migrationsPath = path.join(process.cwd(), 'migrations');
  }

  try {
    await migrate(db, { migrationsFolder: migrationsPath });
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    console.error('Attempted migrations path:', migrationsPath);
    throw error;
  }
}
