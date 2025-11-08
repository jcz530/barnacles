import type { Context } from 'hono';
import type { ProjectWithDetails } from '../services/project-service';

/**
 * Extended Hono context with custom variables
 */
export type AppContext = {
  Variables: {
    project: ProjectWithDetails;
  };
};

/**
 * Type-safe context for routes that use the loadProject middleware
 */
export type ProjectContext = Context<AppContext>;
