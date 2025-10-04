import { Hono } from 'hono';
import os from 'os';
import path from 'path';
import { projectService } from '../services/project-service';

const projects = new Hono();

/**
 * GET /api/projects
 * Get all projects with optional filters
 */
projects.get('/', async c => {
  try {
    const search = c.req.query('search');
    const technologies = c.req.query('technologies');
    const status = c.req.query('status') as 'active' | 'archived' | undefined;

    const filters = {
      search,
      technologies: technologies ? technologies.split(',') : undefined,
      status,
    };

    const projectList = await projectService.getProjects(filters);

    return c.json({
      success: true,
      data: projectList,
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch projects',
      },
      500
    );
  }
});

/**
 * POST /api/projects/scan
 * Scan directories for projects and save to database
 */
projects.post('/scan', async c => {
  try {
    const body = await c.req.json();
    const { directories, maxDepth = 2 } = body;

    // If no directories provided, use common development directories
    const defaultDirectories = [
      path.join(os.homedir(), 'Development'),
      path.join(os.homedir(), 'Projects'),
      path.join(os.homedir(), 'Code'),
      path.join(os.homedir(), 'workspace'),
      path.join(os.homedir(), 'Documents', 'Projects'),
    ];

    const dirsToScan = directories || defaultDirectories;

    const scannedProjects = await projectService.scanAndSaveProjects(dirsToScan, maxDepth);

    return c.json({
      success: true,
      data: scannedProjects,
      message: `Scanned and saved ${scannedProjects.length} projects`,
    });
  } catch (error) {
    console.error('Error scanning projects:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to scan projects',
      },
      500
    );
  }
});

/**
 * DELETE /api/projects/:id
 * Delete a project
 */
projects.delete('/:id', async c => {
  try {
    const id = c.req.param('id');
    await projectService.deleteProject(id);

    return c.json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to delete project',
      },
      500
    );
  }
});

/**
 * PATCH /api/projects/:id/status
 * Update project status
 */
projects.patch('/:id/status', async c => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { status } = body;

    if (!status || !['active', 'archived'].includes(status)) {
      return c.json(
        {
          success: false,
          error: 'Invalid status. Must be "active" or "archived"',
        },
        400
      );
    }

    await projectService.updateProjectStatus(id, status);

    return c.json({
      success: true,
      message: 'Project status updated successfully',
    });
  } catch (error) {
    console.error('Error updating project status:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to update project status',
      },
      500
    );
  }
});

/**
 * POST /api/projects/:id/rescan
 * Rescan a single project to update its information
 */
projects.post('/:id/rescan', async c => {
  try {
    const id = c.req.param('id');
    const project = await projectService.getProjectById(id);

    if (!project) {
      return c.json(
        {
          success: false,
          error: 'Project not found',
        },
        404
      );
    }

    const rescannedProject = await projectService.rescanProject(project.path);

    return c.json({
      success: true,
      data: rescannedProject,
      message: 'Project rescanned successfully',
    });
  } catch (error) {
    console.error('Error rescanning project:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to rescan project',
      },
      500
    );
  }
});

/**
 * GET /api/projects/technologies
 * Get all available technologies
 */
projects.get('/meta/technologies', async c => {
  try {
    const techs = await projectService.getTechnologies();

    return c.json({
      success: true,
      data: techs,
    });
  } catch (error) {
    console.error('Error fetching technologies:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch technologies',
      },
      500
    );
  }
});

/**
 * GET /api/projects/ides/detected
 * Get all detected IDEs on the system
 */
projects.get('/ides/detected', async c => {
  try {
    const ides = await projectService.getDetectedIDEs();

    return c.json({
      success: true,
      data: ides,
    });
  } catch (error) {
    console.error('Error detecting IDEs:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to detect IDEs',
      },
      500
    );
  }
});

/**
 * GET /api/projects/ides/available
 * Get all available IDE definitions
 */
projects.get('/ides/available', async c => {
  try {
    const ides = projectService.getAvailableIDEs();

    return c.json({
      success: true,
      data: ides,
    });
  } catch (error) {
    console.error('Error fetching available IDEs:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch available IDEs',
      },
      500
    );
  }
});

/**
 * PATCH /api/projects/:id/ide
 * Update the preferred IDE for a project
 */
projects.patch('/:id/ide', async c => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { ideId } = body;

    await projectService.updatePreferredIDE(id, ideId);

    return c.json({
      success: true,
      message: 'Preferred IDE updated successfully',
    });
  } catch (error) {
    console.error('Error updating preferred IDE:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to update preferred IDE',
      },
      500
    );
  }
});

/**
 * POST /api/projects/:id/open
 * Open a project in its preferred IDE
 */
projects.post('/:id/open', async c => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const { ideId } = body;

    await projectService.openProjectInIDE(id, ideId);

    return c.json({
      success: true,
      message: 'Project opened in IDE',
    });
  } catch (error) {
    console.error('Error opening project:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open project in IDE',
      },
      500
    );
  }
});

/**
 * GET /api/projects/terminals/detected
 * Get all detected terminals on the system
 */
projects.get('/terminals/detected', async c => {
  try {
    const terminals = await projectService.getDetectedTerminals();

    return c.json({
      success: true,
      data: terminals,
    });
  } catch (error) {
    console.error('Error detecting terminals:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to detect terminals',
      },
      500
    );
  }
});

/**
 * GET /api/projects/terminals/available
 * Get all available terminal definitions
 */
projects.get('/terminals/available', async c => {
  try {
    const terminals = projectService.getAvailableTerminals();

    return c.json({
      success: true,
      data: terminals,
    });
  } catch (error) {
    console.error('Error fetching available terminals:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch available terminals',
      },
      500
    );
  }
});

/**
 * PATCH /api/projects/:id/terminal
 * Update the preferred terminal for a project
 */
projects.patch('/:id/terminal', async c => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { terminalId } = body;

    await projectService.updatePreferredTerminal(id, terminalId);

    return c.json({
      success: true,
      message: 'Preferred terminal updated successfully',
    });
  } catch (error) {
    console.error('Error updating preferred terminal:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to update preferred terminal',
      },
      500
    );
  }
});

/**
 * POST /api/projects/:id/open-terminal
 * Open a terminal at the project path
 */
projects.post('/:id/open-terminal', async c => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const { terminalId } = body;

    await projectService.openTerminalAtProject(id, terminalId);

    return c.json({
      success: true,
      message: 'Terminal opened at project path',
    });
  } catch (error) {
    console.error('Error opening terminal:', error);
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to open terminal',
      },
      500
    );
  }
});

/**
 * GET /api/projects/:id
 * Get a single project by ID
 */
projects.get('/:id', async c => {
  try {
    const id = c.req.param('id');
    const project = await projectService.getProjectById(id);

    if (!project) {
      return c.json(
        {
          success: false,
          error: 'Project not found',
        },
        404
      );
    }

    return c.json({
      success: true,
      data: project,
    });
  } catch (error) {
    console.error('Error fetching project:', error);
    return c.json(
      {
        success: false,
        error: 'Failed to fetch project',
      },
      500
    );
  }
});

export default projects;
