import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import * as schema from '@shared/database/schema';
import path from 'path';

/**
 * Creates an in-memory SQLite database for testing
 */
export function createTestDb() {
  const client = createClient({
    url: ':memory:',
  });

  const db = drizzle(client, { schema });

  return { db, client };
}

/**
 * Runs migrations on the test database
 */
export async function runMigrations(db: ReturnType<typeof drizzle>) {
  const migrationsPath = path.join(process.cwd(), 'migrations');
  await migrate(db, { migrationsFolder: migrationsPath });
}

/**
 * Sets up a fresh test database with migrations applied
 */
export async function setupTestDb() {
  const { db, client } = createTestDb();
  await runMigrations(db);
  return { db, client };
}

/**
 * Cleans up the test database connection
 */
export async function teardownTestDb(client: ReturnType<typeof createClient>) {
  // Close the client connection
  client.close();
}
