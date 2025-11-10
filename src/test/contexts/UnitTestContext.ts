import { vi } from 'vitest';
import { db } from '@shared/database/connection';
import { seedAllDefaults } from '@test/setup/seed-helpers';
import { clearAllTables } from '@test/setup/test-db-helpers';
import type { DB } from '@shared/database';

export interface UnitTestContext {
  db: DB;
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
  /**
   * Setup the test context with database
   * @param options - Configuration options
   */
  async function setup(options: UnitTestOptions = {}): Promise<UnitTestContext> {
    const { seedDefaults = false } = options;

    // Clear all data from the shared in-memory database to ensure test isolation
    await clearAllTables(db);

    // Optionally seed default data
    if (seedDefaults) {
      await seedAllDefaults(db);
    }

    return { db };
  }

  /**
   * Teardown the test context
   */
  async function teardown(): Promise<void> {
    // Clear all data to ensure test isolation
    await clearAllTables(db);
    vi.clearAllMocks();
  }

  /**
   * Get the current context
   */
  function get(): UnitTestContext {
    return { db };
  }

  return { setup, teardown, get };
}

/**
 * Mock the database connection for use in tests
 * This is now a no-op since the database is mocked globally in vitest-setup.ts
 * Kept for backward compatibility with existing test files
 * @deprecated No longer needed - database is mocked globally
 */
export function mockDatabaseConnection() {
  // No-op: The database is now mocked globally in vitest-setup.ts
  // This function is kept for backward compatibility
}
