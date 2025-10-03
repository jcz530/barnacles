import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { APP_CONFIG, updateRuntimeConfig } from '../shared/constants';
import { runMigrations } from '../shared/database/migrate';
import { findAvailablePortInRange } from '../shared/utils/port-finder';
import { corsMiddleware } from './middleware/cors';
import { cspMiddleware } from './middleware/csp';
import api from './routes';

export const createServer = () => {
  const app = new Hono();

  // Middleware
  app.use('*', corsMiddleware());
  app.use(
    '*',
    cspMiddleware({
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", 'localhost:*'],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    })
  );

  // Request logging
  app.use('*', async (c, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    console.log(`${c.req.method} ${c.req.url} - ${c.res.status} (${ms}ms)`);
  });

  // API routes
  app.route('/api', api);

  return app;
};

export const startServer = async () => {
  console.log('🔧 Running database migrations...');
  await runMigrations();

  console.log('🌱 Seeding database...');
  const { seedDatabase } = await import('../shared/database/seed');
  await seedDatabase();

  // Find an available port
  console.log(`🔍 Finding available port (preferred: ${APP_CONFIG.API_PORT_PREFERRED})...`);
  const availablePort = await findAvailablePortInRange(APP_CONFIG.API_PORT_PREFERRED);

  // Update runtime configuration
  const apiBaseUrl = `http://${APP_CONFIG.API_HOST}:${availablePort}`;
  updateRuntimeConfig({
    API_PORT: availablePort,
    API_BASE_URL: apiBaseUrl,
  });

  const app = createServer();

  const server = serve({
    fetch: app.fetch,
    port: availablePort,
    hostname: APP_CONFIG.API_HOST,
  });

  console.log(`🔥 Hono API server running on ${apiBaseUrl}`);

  if (availablePort !== APP_CONFIG.API_PORT_PREFERRED) {
    console.log(
      `ℹ️  Using port ${availablePort} instead of preferred ${APP_CONFIG.API_PORT_PREFERRED}`
    );
  }

  return { server, port: availablePort, baseUrl: apiBaseUrl };
};
