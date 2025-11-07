import type { Context } from 'hono';
import type { projects } from '@shared/database/schema';

/**
 * Extended Hono context with custom variables
 */
export type AppContext = {
  Variables: {
    project: typeof projects.$inferSelect;
  };
};

/**
 * Type-safe context for routes that use the loadProject middleware
 */
export type ProjectContext = Context<AppContext>;
