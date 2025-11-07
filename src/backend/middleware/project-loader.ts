import type { Next } from 'hono';
import { projectService } from '../services/project-service';
import type { ProjectContext } from '../types/hono';

/**
 * Middleware that loads a project by ID from the route parameter
 * and attaches it to the context. If the project is not found,
 * returns a 404 response automatically.
 *
 * Usage:
 *   app.get('/:id', loadProject, async (c: ProjectContext) => {
 *     const project = c.get('project');
 *     // project is fully typed and guaranteed to exist here
 *   });
 */
export async function loadProject(c: ProjectContext, next: Next) {
  try {
    const id = c.req.param('id');

    if (!id) {
      return c.json(
        {
          error: 'Project ID is required',
        },
        400
      );
    }

    const project = await projectService.getProjectById(id);

    if (!project) {
      return c.json(
        {
          error: 'Project not found',
        },
        404
      );
    }

    // Attach project to context for downstream handlers
    c.set('project', project);

    await next();
  } catch (error) {
    console.error('Error loading project:', error);
    return c.json(
      {
        error: 'Failed to load project',
      },
      500
    );
  }
}
