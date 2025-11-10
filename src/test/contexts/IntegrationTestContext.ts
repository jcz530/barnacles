import { vi } from 'vitest';
import { Hono } from 'hono';
import { db } from '@shared/database/connection';
import { clearAllTables } from '@test/setup/test-db-helpers';
import type { DB } from '@shared/database';

export interface IntegrationTestContext {
  db: DB;
  app: Hono;
}

export interface RouteImporter {
  (): Promise<{ default: Hono }>;
}

/**
 * Creates a reusable context for integration tests that test API routes
 *
 * @example
 * ```typescript
 * const context = createIntegrationTestContext();
 *
 * beforeEach(async () => {
 *   await context.setup(async () => {
 *     const projectsRoute = await import('@backend/routes/projects');
 *     const apiRoutes = new Hono();
 *     apiRoutes.route('/api/projects', projectsRoute.default);
 *     return apiRoutes;
 *   });
 * });
 *
 * afterEach(async () => {
 *   await context.teardown();
 * });
 *
 * it('should work', async () => {
 *   const { app, db } = context.get();
 *   // use app and db
 * });
 * ```
 */
export function createIntegrationTestContext() {
  let app: Hono | null = null;

  /**
   * Setup the test context with database and app
   * @param appFactory - Function that creates and returns the Hono app with routes
   */
  async function setup(appFactory: () => Promise<Hono>): Promise<IntegrationTestContext> {
    // Clear all data from the shared in-memory database to ensure test isolation
    await clearAllTables(db);

    // Create the app using the provided factory
    app = await appFactory();

    return { db, app };
  }

  /**
   * Teardown the test context
   */
  async function teardown(): Promise<void> {
    // Clear all data to ensure test isolation
    await clearAllTables(db);
    vi.clearAllMocks();

    // Reset state
    app = null;
  }

  /**
   * Get the current context (throws if not setup)
   */
  function get(): IntegrationTestContext {
    if (!app) {
      throw new Error('Test context not initialized. Did you call setup() in beforeEach?');
    }
    return { db, app };
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
