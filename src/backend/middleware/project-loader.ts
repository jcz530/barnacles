import type { Next } from 'hono';
import { projectService } from '../services/project';
import type { ProjectContext } from '../types/hono';
import { BadRequestException, NotFoundException } from '../exceptions/http-exceptions';

/**
 * Middleware that loads a project by ID from the route parameter
 * and attaches it to the context. If the project is not found,
 * throws a NotFoundException that will be caught by the global error handler.
 *
 * Usage:
 *   app.get('/:id', loadProject, async (c: ProjectContext) => {
 *     const project = c.get('project');
 *     // project is fully typed and guaranteed to exist here
 *   });
 */
export async function loadProject(c: ProjectContext, next: Next) {
  const id = c.req.param('id');

  if (!id) {
    throw new BadRequestException('Project ID is required');
  }

  const project = await projectService.getProjectById(id);

  if (!project) {
    throw new NotFoundException('Project not found');
  }

  // Attach project to context for downstream handlers
  c.set('project', project);

  await next();
}
