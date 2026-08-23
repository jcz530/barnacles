import { Hono } from 'hono';
import type { TLSSocket } from 'tls';
import { APP_CONFIG, updateRuntimeConfig } from '../shared/constants';
import { runMigrations } from '../shared/database/migrate';
import { isDemoMode, isDemoModeMisconfigured } from '../shared/config/runtime-mode';
import { findAvailablePortInRange } from '../shared/utils/port-finder';
import { corsMiddleware } from './middleware/cors';
import { cspMiddleware } from './middleware/csp';
import api from './routes';
import { projectScanWebSocketService } from './services/project-scan-websocket-service';
import { projectRescanSchedulerService } from './services/project-rescan-scheduler-service';
import { terminalWebSocketService } from './services/terminal-websocket-service';
import { portProbeWebSocketService } from './services/port-probe-websocket-service';
import { sweepOrphans } from './services/port-screenshot-cache-service';
import { eventService } from './services/event-service';
import { settingsService } from './services/settings-service';
import { SETTING_KEYS } from '../shared/types/api';
import { processManagerService } from './services/process-manager-service';

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
  // Fail before touching the database: BARNACLES_DEMO without a demo profile
  // would otherwise open the real database while demo mode stays inactive,
  // which is a confusing half-state rather than an obvious error.
  if (isDemoModeMisconfigured()) {
    throw new Error(
      'BARNACLES_DEMO=1 requires BARNACLES_DATA_DIR to point at a ".demo-data" directory. ' +
        'Run `npm run dev:demo` or `npm run screenshots` instead of setting the flag by hand.'
    );
  }

  console.log('🔧 Running database migrations...');
  await runMigrations();

  console.log('🌱 Seeding database...');
  const { seedDatabase } = await import('../shared/database/seed');
  await seedDatabase();

  // Dynamically imported so demo fixtures stay out of the normal startup path.
  if (isDemoMode()) {
    const { seedDemoDatabase } = await import('../shared/database/demo');
    await seedDemoDatabase();
    await processManagerService.loadDemoProcesses();
  }

  try {
    await sweepOrphans();
  } catch (error) {
    console.error('Failed to sweep orphaned screenshot cache entries:', error);
  }

  // Best-effort: keep the usage event log bounded by the retention window.
  const pruneUsageEvents = async () => {
    try {
      const retentionDays =
        (await settingsService.getValue<number>(SETTING_KEYS.MCP_USAGE_RETENTION_DAYS)) ?? 90;
      const { deleted } = await eventService.pruneEvents(retentionDays);
      if (deleted > 0) {
        console.log(`\uD83E\uDDF9 Pruned ${deleted} usage events older than ${retentionDays} days`);
      }
    } catch (error) {
      console.error('Failed to prune usage events:', error);
    }
  };

  await pruneUsageEvents();

  // The app can stay open for days, so don't rely on restarts to enforce
  // retention. unref() so this timer never keeps the process alive.
  const pruneTimer = setInterval(pruneUsageEvents, 24 * 60 * 60 * 1000);
  pruneTimer.unref?.();

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
      const protocol = (req.socket as TLSSocket).encrypted ? 'https' : 'http';
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
  portProbeWebSocketService.initialize(httpServer);

  // Start periodic rescan scheduler
  await projectRescanSchedulerService.start();

  return { server: httpServer, port: availablePort, baseUrl: apiBaseUrl };
};
