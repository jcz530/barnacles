import { Hono } from 'hono';

/**
 * Utilities routes
 * This is a placeholder for future utility-related API endpoints
 * Most utilities will be client-side only, but some may need backend support
 */
const utilities = new Hono();

/**
 * GET /api/utilities
 * List all available utilities (future: could return dynamic utility list)
 */
utilities.get('/', async c => {
  try {
    // For now, just return empty array
    // Future: could query database for utility preferences, history, etc.
    return c.json({ data: [] });
  } catch (error) {
    console.error('Error fetching utilities:', error);
    return c.json({ error: 'Failed to fetch utilities' }, 500);
  }
});

/**
 * POST /api/utilities/:utilityId/execute
 * Execute a utility on the backend (for utilities that need server-side processing)
 */
utilities.post('/:utilityId/execute', async c => {
  try {
    const { utilityId } = c.req.param();
    const body = await c.req.json();

    // Future: implement server-side utility execution
    console.log(`Execute utility ${utilityId} with:`, body);

    return c.json({ message: 'Not implemented yet' }, 501);
  } catch (error) {
    console.error('Error executing utility:', error);
    return c.json({ error: 'Failed to execute utility' }, 500);
  }
});

export default utilities;
