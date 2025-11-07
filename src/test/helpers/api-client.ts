import type { Hono } from 'hono';

/**
 * Makes a test request to a Hono app
 */
export async function testRequest(
  app: Hono,
  path: string,
  options?: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    headers?: Record<string, string>;
  }
) {
  const method = options?.method || 'GET';
  const headers = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };

  const request = new Request(`http://localhost${path}`, {
    method,
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  const response = await app.fetch(request);

  // Parse JSON if response has content-type application/json
  const contentType = response.headers.get('content-type');
  let data: unknown = null;

  if (contentType?.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  return {
    status: response.status,
    headers: response.headers,
    data,
  };
}

/**
 * Convenience wrapper for GET requests
 */
export async function get(app: Hono, path: string, headers?: Record<string, string>) {
  return testRequest(app, path, { method: 'GET', headers });
}

/**
 * Convenience wrapper for POST requests
 */
export async function post(
  app: Hono,
  path: string,
  body?: unknown,
  headers?: Record<string, string>
) {
  return testRequest(app, path, { method: 'POST', body, headers });
}

/**
 * Convenience wrapper for PUT requests
 */
export async function put(
  app: Hono,
  path: string,
  body?: unknown,
  headers?: Record<string, string>
) {
  return testRequest(app, path, { method: 'PUT', body, headers });
}

/**
 * Convenience wrapper for PATCH requests
 */
export async function patch(
  app: Hono,
  path: string,
  body?: unknown,
  headers?: Record<string, string>
) {
  return testRequest(app, path, { method: 'PATCH', body, headers });
}

/**
 * Convenience wrapper for DELETE requests
 */
export async function del(app: Hono, path: string, headers?: Record<string, string>) {
  return testRequest(app, path, { method: 'DELETE', headers });
}
