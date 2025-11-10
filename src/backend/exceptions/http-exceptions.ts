import { StatusCode } from 'hono/utils/http-status';

/**
 * Base HTTP Exception class
 * All HTTP exceptions extend this class
 */
export class HttpException extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: StatusCode,
    public readonly code?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 Bad Request
 * Used when the client sends invalid data
 */
export class BadRequestException extends HttpException {
  constructor(message = 'Bad Request', code?: string) {
    super(message, 400, code);
  }
}

/**
 * 401 Unauthorized
 * Used when authentication is required but not provided
 */
export class UnauthorizedException extends HttpException {
  constructor(message = 'Unauthorized', code?: string) {
    super(message, 401, code);
  }
}

/**
 * 403 Forbidden
 * Used when the user doesn't have permission to access a resource
 */
export class ForbiddenException extends HttpException {
  constructor(message = 'Forbidden', code?: string) {
    super(message, 403, code);
  }
}

/**
 * 404 Not Found
 * Used when a resource cannot be found
 */
export class NotFoundException extends HttpException {
  constructor(message = 'Not Found', code?: string) {
    super(message, 404, code);
  }
}

/**
 * 409 Conflict
 * Used when there's a conflict with the current state (e.g., duplicate entry)
 */
export class ConflictException extends HttpException {
  constructor(message = 'Conflict', code?: string) {
    super(message, 409, code);
  }
}

/**
 * 422 Unprocessable Entity
 * Used when the request is well-formed but contains semantic errors
 */
export class UnprocessableEntityException extends HttpException {
  constructor(message = 'Unprocessable Entity', code?: string) {
    super(message, 422, code);
  }
}

/**
 * 500 Internal Server Error
 * Used for unexpected server errors
 */
export class InternalServerErrorException extends HttpException {
  constructor(message = 'Internal Server Error', code?: string) {
    super(message, 500, code);
  }
}
