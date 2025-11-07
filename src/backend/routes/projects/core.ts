import { Hono } from 'hono';
import { projectService } from '../../services/project-service';
import { loadProject } from '../../middleware/project-loader';
import type { ProjectContext } from '../../types/hono';

const core = new Hono();

/**
 * GET /
 * Get all projects with optional filters
 */
core.get('/', async c => {
  try {
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
  } catch (error) {
    console.error('Error fetching projects:', error);
    return c.json(
      {
        error: 'Failed to fetch projects',
      },
      500
    );
  }
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
  try {
    const project = c.get('project');
    await projectService.deleteProject(project.id);

    return c.json({
      message: 'Project deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    return c.json(
      {
        error: 'Failed to delete project',
      },
      500
    );
  }
});

/**
 * PATCH /:id/favorite
 * Toggle project favorite status
 */
core.patch('/:id/favorite', loadProject, async (c: ProjectContext) => {
  try {
    const project = c.get('project');
    const isFavorite = await projectService.toggleProjectFavorite(project.id);

    return c.json({
      data: { isFavorite },
      message: `Project ${isFavorite ? 'added to' : 'removed from'} favorites`,
    });
  } catch (error) {
    console.error('Error toggling favorite:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to toggle favorite',
      },
      500
    );
  }
});

/**
 * PATCH /:id/archive
 * Archive a project (sets archivedAt to current timestamp)
 */
core.patch('/:id/archive', loadProject, async (c: ProjectContext) => {
  try {
    const project = c.get('project');
    await projectService.archiveProject(project.id);

    return c.json({
      message: 'Project archived successfully',
    });
  } catch (error) {
    console.error('Error archiving project:', error);
    return c.json(
      {
        error: 'Failed to archive project',
      },
      500
    );
  }
});

/**
 * PATCH /:id/unarchive
 * Unarchive a project (sets archivedAt to null)
 */
core.patch('/:id/unarchive', loadProject, async (c: ProjectContext) => {
  try {
    const project = c.get('project');
    await projectService.unarchiveProject(project.id);

    return c.json({
      message: 'Project unarchived successfully',
    });
  } catch (error) {
    console.error('Error unarchiving project:', error);
    return c.json(
      {
        error: 'Failed to unarchive project',
      },
      500
    );
  }
});

/**
 * POST /:id/rescan
 * Rescan a single project to update its information
 */
core.post('/:id/rescan', loadProject, async (c: ProjectContext) => {
  try {
    const project = c.get('project');
    const rescannedProject = await projectService.rescanProject(project.path);

    return c.json({
      data: rescannedProject,
      message: 'Project rescanned successfully',
    });
  } catch (error) {
    console.error('Error rescanning project:', error);
    return c.json(
      {
        error: 'Failed to rescan project',
      },
      500
    );
  }
});

export default core;
