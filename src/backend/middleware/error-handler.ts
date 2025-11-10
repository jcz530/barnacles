import { Context } from 'hono';
import { HttpException } from '../exceptions/http-exceptions';
import { UnofficialStatusCode } from 'hono/utils/http-status';

/**
 * Global error handler middleware
 * Catches all errors thrown in route handlers and formats them consistently
 *
 * Usage:
 *   app.onError(errorHandler);
 */
export function errorHandler(err: Error, c: Context): Response {
  console.error('Error caught by global handler:', err);

  // Handle our custom HTTP exceptions
  if (err instanceof HttpException) {
    return c.json(
      {
        error: err.message,
        ...(err.code && { code: err.code }),
      },
      err.statusCode as UnofficialStatusCode
    );
  }

  // Handle unexpected errors
  return c.json(
    {
      error: 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { details: err.message }),
    },
    500
  );
}
