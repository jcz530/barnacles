import { Hono } from 'hono';
import { discoverExistingDirectories } from '../utils/default-scan-directories';

const onboarding = new Hono();

/**
 * GET /api/onboarding/discover-directories
 * Discover which default project directories exist on the system
 */
onboarding.get('/discover-directories', async c => {
  try {
    const directories = await discoverExistingDirectories();
    return c.json({
      directories,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error discovering directories:', error);
    return c.json(
      {
        error: 'Failed to discover directories',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
});

export default onboarding;
