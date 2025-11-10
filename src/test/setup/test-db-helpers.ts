/**
 * Helper functions for managing the test database
 */

import { sql } from 'drizzle-orm';
import type { DB } from '@shared/database';

/**
 * Clears all data from all tables in the database
 * This is used to ensure test isolation when using a shared in-memory database
 */
export async function clearAllTables(db: DB): Promise<void> {
  // Get all table names from sqlite_master
  const tables = await db.all<{ name: string }>(
    sql`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '__drizzle%'`
  );

  // Delete all rows from each table
  for (const table of tables) {
    await db.run(sql.raw(`DELETE FROM ${table.name}`));
  }
}
