import type { Context, Next } from 'hono';
import { db, users } from '@shared/database';
import { eq } from 'drizzle-orm';
import { BadRequestException, NotFoundException } from '../exceptions/http-exceptions';

export type UserContext = Context<{
  Variables: {
    user: typeof users.$inferSelect;
  };
}>;

/**
 * Middleware that loads a user by ID from the route parameter
 * and attaches it to the context. If the user is not found,
 * throws a NotFoundException that will be caught by the global error handler.
 *
 * Usage:
 *   app.get('/:id', loadUser, async (c: UserContext) => {
 *     const user = c.get('user');
 *     // user is fully typed and guaranteed to exist here
 *   });
 */
export async function loadUser(c: UserContext, next: Next) {
  const id = c.req.param('id');

  if (!id) {
    throw new BadRequestException('User ID is required');
  }

  const [user] = await db.select().from(users).where(eq(users.id, id));

  if (!user) {
    throw new NotFoundException('User not found');
  }

  c.set('user', user);

  await next();
}
