/**
 * Global test setup file
 * Mocks native modules that can't run in test environment
 */

import { vi } from 'vitest';
import { db } from '@shared/database/connection';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'path';

// Mock node-pty which is compiled for Electron's Node version
// Our tests run in standalone Node which has a different MODULE_VERSION
vi.mock('node-pty', () => ({
  spawn: vi.fn(() => ({
    onData: vi.fn(),
    onExit: vi.fn(),
    write: vi.fn(),
    kill: vi.fn(),
    resize: vi.fn(),
    pid: 12345,
  })),
  IPty: vi.fn(),
}));

// Run migrations once on the shared in-memory database
// This ensures all tests use a database with the correct schema
let migrationsRun = false;

if (!migrationsRun) {
  // eslint-disable-next-line no-undef
  const migrationsPath = path.join(process.cwd(), 'migrations');
  await migrate(db, { migrationsFolder: migrationsPath });
  migrationsRun = true;
  console.log('✓ Test setup: Migrations applied to shared in-memory database');
}
