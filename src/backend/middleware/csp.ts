import type { MiddlewareHandler } from 'hono';

interface CSPOptions {
  defaultSrc?: string[];
  scriptSrc?: string[];
  styleSrc?: string[];
  imgSrc?: string[];
  connectSrc?: string[];
  fontSrc?: string[];
  objectSrc?: string[];
  mediaSrc?: string[];
  frameSrc?: string[];
  reportOnly?: boolean;
}

export const cspMiddleware = (options: CSPOptions = {}): MiddlewareHandler => {
  return async (c, next) => {
    const {
      defaultSrc = ["'self'"],
      scriptSrc = ["'self'"],
      styleSrc = ["'self'", "'unsafe-inline'"],
      imgSrc = ["'self'", 'data:', 'blob:'],
      connectSrc = ["'self'"],
      fontSrc = ["'self'"],
      objectSrc = ["'none'"],
      mediaSrc = ["'self'"],
      frameSrc = ["'none'"],
      reportOnly = false,
    } = options;

    const directives = [
      `default-src ${defaultSrc.join(' ')}`,
      `script-src ${scriptSrc.join(' ')}`,
      `style-src ${styleSrc.join(' ')}`,
      `img-src ${imgSrc.join(' ')}`,
      `connect-src ${connectSrc.join(' ')}`,
      `font-src ${fontSrc.join(' ')}`,
      `object-src ${objectSrc.join(' ')}`,
      `media-src ${mediaSrc.join(' ')}`,
      `frame-src ${frameSrc.join(' ')}`,
    ];

    const cspValue = directives.join('; ');
    const headerName = reportOnly
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy';

    c.header(headerName, cspValue);

    await next();
  };
};
