import { runMigrations } from '../src/shared/database/migrate';

async function main(): Promise<void> {
  try {
    await runMigrations();
    console.log('Migration script completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Migration script failed:', error);
    process.exit(1);
  }
}

main();