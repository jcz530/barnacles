import { Hono } from 'hono';
import { projectService } from '../../services/project-service';
import { loadProject } from '../../middleware/project-loader';
import type { ProjectContext } from '../../types/hono';
import { BadRequestException } from '../../exceptions/http-exceptions';

const core = new Hono();

/**
 * GET /
 * Get all projects with optional filters
 */
core.get('/', async c => {
  const search = c.req.query('search');
  const technologies = c.req.query('technologies');
  const includeArchived = c.req.query('includeArchived') === 'true';

  const filters = {
    search,
    technologies: technologies ? technologies.split(',') : undefined,
    includeArchived,
  };

  const projectList = await projectService.getProjects(filters);

  return c.json({
    data: projectList,
  });
});

/**
 * GET /:id
 * Get a single project by ID
 */
core.get('/:id', loadProject, async (c: ProjectContext) => {
  const project = c.get('project');

  return c.json({
    data: project,
  });
});

/**
 * DELETE /:id
 * Delete a project
 */
core.delete('/:id', loadProject, async (c: ProjectContext) => {
  const project = c.get('project');
  await projectService.deleteProject(project.id);

  return c.json({
    message: 'Project deleted successfully',
  });
});

/**
 * PATCH /:id/favorite
 * Toggle project favorite status
 */
core.patch('/:id/favorite', loadProject, async (c: ProjectContext) => {
  const project = c.get('project');
  const isFavorite = await projectService.toggleProjectFavorite(project.id);

  return c.json({
    data: { isFavorite },
    message: `Project ${isFavorite ? 'added to' : 'removed from'} favorites`,
  });
});

/**
 * PATCH /:id/archive
 * Archive a project (sets archivedAt to current timestamp)
 */
core.patch('/:id/archive', loadProject, async (c: ProjectContext) => {
  const project = c.get('project');
  await projectService.archiveProject(project.id);

  return c.json({
    message: 'Project archived successfully',
  });
});

/**
 * PATCH /:id/unarchive
 * Unarchive a project (sets archivedAt to null)
 */
core.patch('/:id/unarchive', loadProject, async (c: ProjectContext) => {
  const project = c.get('project');
  await projectService.unarchiveProject(project.id);

  return c.json({
    message: 'Project unarchived successfully',
  });
});

/**
 * POST /:id/rescan
 * Rescan a single project to update its information
 */
core.post('/:id/rescan', loadProject, async (c: ProjectContext) => {
  const project = c.get('project');
  const rescannedProject = await projectService.rescanProject(project.path);

  return c.json({
    data: rescannedProject,
    message: 'Project rescanned successfully',
  });
});

export default core;
