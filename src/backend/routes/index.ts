import { Hono } from 'hono';
import processes from './processes';
import projects from './projects';
import settings from './settings';
import system from './system';
import users from './users';

// Read version from package.json
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let appVersion = '0.0.0';
try {
  const packageJsonPath = join(__dirname, '../../../package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  appVersion = packageJson.version;
} catch (error) {
  console.error('Failed to read version from package.json:', error);
}

const api = new Hono();

api
  .get('/hello', c => {
    return c.json({
      message: 'Hello from Hono! 🔥',
      timestamp: new Date().toISOString(),
    });
  })

  // Health check endpoint
  .get('/health', c => {
    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  })

  // Version endpoint
  .get('/version', c => {
    return c.json({
      version: appVersion,
      timestamp: new Date().toISOString(),
    });
  })

  .route('/users', users)
  .route('/projects', projects)
  .route('/processes', processes)
  .route('/settings', settings)
  .route('/system', system);

export default api;
