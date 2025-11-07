import { Hono } from 'hono';
import { projectService } from '../../services/project-service';

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
core.get('/:id', async c => {
  try {
    const id = c.req.param('id');
    const project = await projectService.getProjectById(id);

    if (!project) {
      return c.json(
        {
          error: 'Project not found',
        },
        404
      );
    }

    return c.json({
      data: project,
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    return c.json(
      {
        error: 'Failed to fetch project',
      },
      500
    );
  }
});

/**
 * DELETE /:id
 * Delete a project
 */
core.delete('/:id', async c => {
  try {
    const id = c.req.param('id');
    await projectService.deleteProject(id);

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
core.patch('/:id/favorite', async c => {
  try {
    const id = c.req.param('id');
    const isFavorite = await projectService.toggleProjectFavorite(id);

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
core.patch('/:id/archive', async c => {
  try {
    const id = c.req.param('id');
    await projectService.archiveProject(id);

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
core.patch('/:id/unarchive', async c => {
  try {
    const id = c.req.param('id');
    await projectService.unarchiveProject(id);

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
core.post('/:id/rescan', async c => {
  try {
    const id = c.req.param('id');
    const project = await projectService.getProjectById(id);

    if (!project) {
      return c.json(
        {
          error: 'Project not found',
        },
        404
      );
    }

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
