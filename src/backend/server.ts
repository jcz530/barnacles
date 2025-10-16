import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { APP_CONFIG, updateRuntimeConfig } from '../shared/constants';
import { runMigrations } from '../shared/database/migrate';
import { findAvailablePortInRange } from '../shared/utils/port-finder';
import { corsMiddleware } from './middleware/cors';
import { cspMiddleware } from './middleware/csp';
import api from './routes';
import { projectScanWebSocketService } from './services/project-scan-websocket-service';
import { projectRescanSchedulerService } from './services/project-rescan-scheduler-service';
import { terminalWebSocketService } from './services/terminal-websocket-service';

export const createServer = () => {
  const app = new Hono();

  // Middleware - Skip for WebSocket upgrade requests
  app.use('*', async (c, next) => {
    // Skip middleware for WebSocket upgrade requests
    const upgrade = c.req.header('upgrade');
    if (upgrade && upgrade.toLowerCase() === 'websocket') {
      return await next();
    }

    // Apply CORS middleware
    await corsMiddleware()(c, async () => {
      // Apply CSP middleware
      await cspMiddleware({
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", 'localhost:*', 'ws://localhost:*', 'wss://localhost:*'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      })(c, next);
    });
  });

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

  // Create a raw Node.js HTTP server for proper WebSocket support
  const http = await import('http');
  const httpServer = http.createServer();

  // Handle regular HTTP requests (not WebSocket upgrades)
  httpServer.on('request', async (req, res) => {
    try {
      // Convert Node.js IncomingMessage to Fetch API Request
      const protocol = req.socket.encrypted ? 'https' : 'http';
      const url = `${protocol}://${req.headers.host || `${APP_CONFIG.API_HOST}:${availablePort}`}${req.url}`;

      // Collect request body for non-GET/HEAD requests
      let body: Buffer | undefined;
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
          chunks.push(chunk);
        }
        body = Buffer.concat(chunks);
      }

      // Create Fetch API Request
      const request = new Request(url, {
        method: req.method,
        headers: Object.fromEntries(
          Object.entries(req.headers)
            .filter(([_, v]) => v !== undefined)
            .map(([k, v]) => [k, Array.isArray(v) ? v.join(', ') : String(v)])
        ),
        body: body,
      });

      // Let Hono handle the request
      const response = await app.fetch(request);

      // Convert Fetch API Response back to Node.js response
      res.statusCode = response.status;
      response.headers.forEach((value, key) => {
        res.setHeader(key, value);
      });

      // Stream response body
      if (response.body) {
        const reader = response.body.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
        } finally {
          reader.releaseLock();
        }
      }

      res.end();
    } catch (error) {
      console.error('Error handling request:', error);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: 'Internal server error' }));
      }
    }
  });

  httpServer.listen(availablePort, APP_CONFIG.API_HOST);

  console.log(`🔥 Hono API server running on ${apiBaseUrl}`);

  if (availablePort !== APP_CONFIG.API_PORT_PREFERRED) {
    console.log(
      `ℹ️  Using port ${availablePort} instead of preferred ${APP_CONFIG.API_PORT_PREFERRED}`
    );
  }

  // Initialize WebSocket services with the HTTP server
  projectScanWebSocketService.initialize(httpServer);
  terminalWebSocketService.initialize(httpServer);

  // Start periodic rescan scheduler
  await projectRescanSchedulerService.start();

  return { server: httpServer, port: availablePort, baseUrl: apiBaseUrl };
};
