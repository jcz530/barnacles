import type { Next, Context } from 'hono';
import { themeService } from '../services/theme-service';
import { BadRequestException, NotFoundException } from '../exceptions/http-exceptions';
import type { themes } from '@shared/database/schema';

export type ThemeContext = Context<{
  Variables: {
    theme: typeof themes.$inferSelect;
  };
}>;

/**
 * Middleware that loads a theme by ID from the route parameter
 * and attaches it to the context. If the theme is not found,
 * throws a NotFoundException that will be caught by the global error handler.
 *
 * Usage:
 *   app.get('/:id', loadTheme, async (c: ThemeContext) => {
 *     const theme = c.get('theme');
 *     // theme is fully typed and guaranteed to exist here
 *   });
 */
export async function loadTheme(c: ThemeContext, next: Next) {
  const id = c.req.param('id');

  if (!id) {
    throw new BadRequestException('Theme ID is required');
  }

  const theme = await themeService.getTheme(id);

  if (!theme) {
    throw new NotFoundException('Theme not found');
  }

  c.set('theme', theme);

  await next();
}
