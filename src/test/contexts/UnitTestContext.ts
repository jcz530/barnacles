import { vi } from 'vitest';
import { setupTestDb, teardownTestDb } from '@test/setup/test-db';
import { seedAllDefaults } from '@test/setup/seed-helpers';
import type { DB } from '@shared/database';
import type { Client } from '@libsql/client';

export interface UnitTestContext {
  db: DB;
  client: Client;
}

export interface UnitTestOptions {
  /** Whether to seed default data (settings, themes, etc.) */
  seedDefaults?: boolean;
}

/**
 * Creates a reusable context for unit tests that need database access
 *
 * @example
 * ```typescript
 * const context = createUnitTestContext();
 *
 * beforeEach(async () => {
 *   await context.setup({ seedDefaults: true });
 * });
 *
 * afterEach(async () => {
 *   await context.teardown();
 * });
 *
 * it('should work', async () => {
 *   const { db } = context.get();
 *   // use db
 * });
 * ```
 */
export function createUnitTestContext() {
  let testDb: DB | null = null;
  let testClient: Client | null = null;

  /**
   * Setup the test context with database
   * @param options - Configuration options
   */
  async function setup(options: UnitTestOptions = {}): Promise<UnitTestContext> {
    const { seedDefaults = false } = options;

    // Setup test database with migrations
    const { db, client } = await setupTestDb();
    testDb = db;
    testClient = client;

    // Mock the database connection module
    const connectionModule = await import('@shared/database/connection');
    (connectionModule as any).db = testDb;

    // Optionally seed default data
    if (seedDefaults) {
      await seedAllDefaults(testDb);
    }

    return { db: testDb, client: testClient };
  }

  /**
   * Teardown the test context
   */
  async function teardown(): Promise<void> {
    if (testClient) {
      await teardownTestDb(testClient);
    }
    vi.clearAllMocks();

    // Reset state
    testDb = null;
    testClient = null;
  }

  /**
   * Get the current context (throws if not setup)
   */
  function get(): UnitTestContext {
    if (!testDb || !testClient) {
      throw new Error('Test context not initialized. Did you call setup() in beforeEach?');
    }
    return { db: testDb, client: testClient };
  }

  return { setup, teardown, get };
}

/**
 * Mock the database connection for use in tests
 * This should be called at the top of test files before any imports
 */
export function mockDatabaseConnection() {
  vi.mock('@shared/database/connection', async () => {
    const actual = await vi.importActual('@shared/database/connection');
    return {
      ...actual,
      db: null, // Will be replaced in setup
    };
  });
}
