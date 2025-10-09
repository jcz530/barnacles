import { migrate } from 'drizzle-orm/libsql/migrator';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import path from 'path';
import * as schema from '../src/shared/database/schema';

async function main(): Promise<void> {
  try {
    // Create a standalone database connection for migration script
    const dbUrl = process.env.DATABASE_URL || 'file:./database.db';
    const client = createClient({ url: dbUrl });
    const db = drizzle(client, { schema });

    // Run migrations from project root
    const migrationsPath = path.join(process.cwd(), 'migrations');

    console.log('Running migrations...');
    console.log('Database:', dbUrl);
    console.log('Migrations path:', migrationsPath);

    await migrate(db, { migrationsFolder: migrationsPath });

    console.log('Migration script completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration script failed:', error);
    process.exit(1);
  }
}

main();