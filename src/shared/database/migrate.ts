import { db } from './connection';
import path from 'path';
import { app } from 'electron';
import { readdir, readFile } from 'fs/promises';
import { sql } from 'drizzle-orm';

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
    console.log('🔧 Running database migrations from:', migrationsPath);

    // Create migrations tracking table if it doesn't exist
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL
      )
    `);

    // Read the journal to get the list of migrations
    const journalPath = path.join(migrationsPath, 'meta', '_journal.json');
    const journalContent = await readFile(journalPath, 'utf-8');
    const journal = JSON.parse(journalContent);

    // Get already applied migrations
    const appliedMigrations = await db.all<{ hash: string }>(
      sql`SELECT hash FROM __drizzle_migrations`
    );
    const appliedHashes = new Set(appliedMigrations.map(m => m.hash));

    // Process migrations in order
    for (const entry of journal.entries) {
      const migrationTag = entry.tag;

      // Skip if already applied
      if (appliedHashes.has(migrationTag)) {
        console.log(`⏭️  Skipping already applied migration: ${migrationTag}`);
        continue;
      }

      console.log(`📝 Applying migration: ${migrationTag}`);

      // Read the migration file
      const migrationPath = path.join(migrationsPath, `${migrationTag}.sql`);
      const migrationContent = await readFile(migrationPath, 'utf-8');

      // Split by statement-breakpoint and execute each statement
      const statements = migrationContent
        .split('--> statement-breakpoint')
        .map(s => s.trim())
        .filter(s => s && !s.startsWith('--'));

      for (const statement of statements) {
        await db.run(sql.raw(statement));
      }

      // Record the migration as applied
      await db.run(
        sql`INSERT INTO __drizzle_migrations (hash, created_at) VALUES (${migrationTag}, ${Date.now()})`
      );

      console.log(`✅ Applied migration: ${migrationTag}`);
    }

    console.log('✨ Migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Attempted migrations path:', migrationsPath);
    throw error;
  }
}
