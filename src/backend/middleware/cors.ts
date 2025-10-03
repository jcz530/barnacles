import type { MiddlewareHandler } from 'hono';

export const corsMiddleware = (): MiddlewareHandler => {
  return async (c, next) => {
    // Since we're running in Electron, we have more control over CORS
    // but it's good practice to set these headers
    // TODO: restrict origin
    c.header('Access-Control-Allow-Origin', '*');
    c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (c.req.method === 'OPTIONS') {
      return c.text('', 200);
    }

    await next();
  };
};
