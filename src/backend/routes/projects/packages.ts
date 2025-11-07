import { Hono } from 'hono';
import { projectService } from '../../services/project-service';

const packages = new Hono();

/**
 * GET /:id/package-scripts
 * Get package.json scripts for a project
 */
packages.get('/:id/package-scripts', async c => {
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

    const scripts = await projectService.getPackageScripts(project.path);

    return c.json({
      data: scripts,
    });
  } catch (error) {
    console.error('Error fetching package scripts:', error);
    return c.json(
      {
        error: 'Failed to fetch package scripts',
      },
      500
    );
  }
});

/**
 * GET /:id/composer-scripts
 * Get composer.json scripts for a project
 */
packages.get('/:id/composer-scripts', async c => {
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

    const scripts = await projectService.getComposerScripts(project.path);

    return c.json({
      data: scripts,
    });
  } catch (error) {
    console.error('Error fetching composer scripts:', error);
    return c.json(
      {
        error: 'Failed to fetch composer scripts',
      },
      500
    );
  }
});

/**
 * GET /:id/package-manager
 * Detect the package manager used by a project (npm, yarn, or pnpm)
 */
packages.get('/:id/package-manager', async c => {
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

    const packageManager = await projectService.detectPackageManager(project.path);

    return c.json({
      data: packageManager,
    });
  } catch (error) {
    console.error('Error detecting package manager:', error);
    return c.json(
      {
        error: 'Failed to detect package manager',
      },
      500
    );
  }
});

/**
 * POST /:id/delete-packages
 * Delete third-party packages from a project
 */
packages.post('/:id/delete-packages', async c => {
  try {
    const id = c.req.param('id');
    const result = await projectService.deleteThirdPartyPackages(id);

    return c.json({
      data: result,
      message: 'Third-party packages deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting packages:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to delete packages',
      },
      500
    );
  }
});

export default packages;
