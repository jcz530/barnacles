import { Hono } from 'hono';

/**
 * Sets up a Hono app with project routes and error handling for integration tests.
 * This helper reduces boilerplate in route test files.
 *
 * @param context - The integration test context object returned by createIntegrationTestContext()
 * @returns The context for chaining
 *
 * @example
 * ```ts
 * const context = createIntegrationTestContext();
 *
 * beforeEach(async () => {
 *   await setupProjectRoutes(context);
 * });
 * ```
 */
export async function setupProjectRoutes(context: {
  setup: (appFactory: () => Promise<Hono>) => Promise<unknown>;
}): Promise<void> {
  await context.setup(async () => {
    // Import routes and create app
    const projectsRoute = await import('@backend/routes/projects');
    const { errorHandler } = await import('@backend/middleware/error-handler');
    const apiRoutes = new Hono();
    apiRoutes.onError(errorHandler);
    apiRoutes.route('/api/projects', projectsRoute.default);
    return apiRoutes;
  });
}
