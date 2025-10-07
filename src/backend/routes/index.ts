import { Hono } from 'hono';
import projects from './projects';
import settings from './settings';
import system from './system';
import terminals from './terminals';
import users from './users';

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

  .route('/users', users)
  .route('/projects', projects)
  .route('/terminals', terminals)
  .route('/settings', settings)
  .route('/system', system);

export default api;
