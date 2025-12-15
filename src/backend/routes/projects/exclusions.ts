import { Hono } from 'hono';
import { projectService } from '../../services/project';
import { loadProject } from '../../middleware/project-loader';
import type { ProjectContext } from '../../types/hono';
import { BadRequestException } from '../../exceptions/http-exceptions';

const exclusions = new Hono();

/**
 * GET /:id/exclusions
 * Get all exclusions for a project
 */
exclusions.get('/:id/exclusions', loadProject, async (c: ProjectContext) => {
  const project = c.get('project');
  const projectExclusions = await projectService.getExclusions(project.id);

  return c.json({
    data: projectExclusions,
  });
});

/**
 * POST /:id/exclusions
 * Add an exclusion to a project
 */
exclusions.post('/:id/exclusions', loadProject, async (c: ProjectContext) => {
  const project = c.get('project');
  const body = await c.req.json();
  const { path } = body;

  if (!path) {
    throw new BadRequestException('path is required');
  }

  const result = await projectService.addExclusion(project.id, path);

  if (!result.success) {
    throw new BadRequestException(result.error || 'Failed to add exclusion');
  }

  return c.json({
    data: result.exclusion,
  });
});

/**
 * DELETE /:id/exclusions/:exclusionId
 * Remove an exclusion from a project
 */
exclusions.delete('/:id/exclusions/:exclusionId', async c => {
  const exclusionId = c.req.param('exclusionId');
  const result = await projectService.removeExclusion(exclusionId);

  return c.json({
    success: result.success,
  });
});

export default exclusions;
