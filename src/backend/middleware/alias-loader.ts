import type { Context, Next } from 'hono';
import { aliases, db } from '../../shared/database';
import { eq } from 'drizzle-orm';
import { BadRequestException, NotFoundException } from '../exceptions/http-exceptions';

export type AliasContext = Context<{
  Variables: {
    alias: typeof aliases.$inferSelect;
  };
}>;

/**
 * Middleware that loads an alias by ID from the route parameter
 * and attaches it to the context. If the alias is not found,
 * throws a NotFoundException that will be caught by the global error handler.
 *
 * Usage:
 *   app.get('/:id', loadAlias, async (c: AliasContext) => {
 *     const alias = c.get('alias');
 *     // alias is fully typed and guaranteed to exist here
 *   });
 */
export async function loadAlias(c: AliasContext, next: Next) {
  const id = c.req.param('id');

  if (!id) {
    throw new BadRequestException('Alias ID is required');
  }

  const [alias] = await db.select().from(aliases).where(eq(aliases.id, id));

  if (!alias) {
    throw new NotFoundException('Alias not found');
  }

  c.set('alias', alias);

  await next();
}
