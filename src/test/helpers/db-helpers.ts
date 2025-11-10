import type { DB } from '@shared/database';
import { eq } from 'drizzle-orm';
import * as schema from '@shared/database/schema';

/**
 * Clears all tables in the database for testing
 */
export async function clearAllTables(db: DB) {
  // Delete in order to respect foreign key constraints
  await db.delete(schema.projectProcessCommands);
  await db.delete(schema.projectProcesses);
  await db.delete(schema.projectRelatedFolders);
  await db.delete(schema.projectLanguageStats);
  await db.delete(schema.projectStats);
  await db.delete(schema.projectTechnologies);
  await db.delete(schema.projects);
  await db.delete(schema.technologies);
  await db.delete(schema.aliases);
  await db.delete(schema.aliasThemes);
  await db.delete(schema.settings);
  await db.delete(schema.themes);
  await db.delete(schema.users);
}

/**
 * Counts rows in a table for assertions
 */
export async function countRows(db: DB, table: keyof typeof schema) {
  const tableSchema = schema[table];
  if (!tableSchema) {
    throw new Error(`Table ${table} not found in schema`);
  }
  const result = await db.select().from(tableSchema as any);
  return result.length;
}

/**
 * Checks if a record exists by ID
 */
export async function recordExists(
  db: DB,
  table: keyof typeof schema,
  id: string
): Promise<boolean> {
  const tableSchema = schema[table];
  if (!tableSchema) {
    throw new Error(`Table ${table} not found in schema`);
  }

  // Most tables use 'id' as primary key, settings uses 'key'
  const idColumn = table === 'settings' ? (tableSchema as any).key : (tableSchema as any).id;

  const result = await db
    .select()
    .from(tableSchema as any)
    .where(eq(idColumn, id))
    .limit(1);

  return result.length > 0;
}
