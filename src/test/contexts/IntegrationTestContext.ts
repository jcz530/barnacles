import { vi } from 'vitest';
import { Hono } from 'hono';
import { setupTestDb, teardownTestDb } from '@test/setup/test-db';
import type { DB } from '@shared/database';
import type { Client } from '@libsql/client';

export interface IntegrationTestContext {
  db: DB;
  client: Client;
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
  let testDb: DB | null = null;
  let testClient: Client | null = null;
  let app: Hono | null = null;

  /**
   * Setup the test context with database and app
   * @param appFactory - Function that creates and returns the Hono app with routes
   */
  async function setup(appFactory: () => Promise<Hono>): Promise<IntegrationTestContext> {
    // Setup test database with migrations
    const { db, client } = await setupTestDb();
    testDb = db;
    testClient = client;

    // Mock the database connection module
    const connectionModule = await import('@shared/database/connection');
    (connectionModule as any).db = testDb;

    // Create the app using the provided factory
    app = await appFactory();

    return { db: testDb, client: testClient, app };
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
    app = null;
  }

  /**
   * Get the current context (throws if not setup)
   */
  function get(): IntegrationTestContext {
    if (!testDb || !testClient || !app) {
      throw new Error('Test context not initialized. Did you call setup() in beforeEach?');
    }
    return { db: testDb, client: testClient, app };
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
