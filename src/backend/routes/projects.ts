import { Hono } from 'hono';
import os from 'os';
import path from 'path';
import type { StartProcess } from '../../shared/types/process';
import { processManagerService } from '../services/process-manager-service';
import { projectService } from '../services/project-service';
import { settingsService } from '../services/settings-service';

const projects = new Hono();

/**
 * GET /api/projects
 * Get all projects with optional filters
 */
projects.get('/', async c => {
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
 * POST /api/projects/scan
 * Scan directories for projects and save to database
 */
projects.post('/scan', async c => {
  try {
    let body;
    try {
      body = await c.req.json();
    } catch {
      // No body provided or invalid JSON
      body = {};
    }

    // Get maxDepth from settings, fallback to body param, then default to 3
    const settingMaxDepth = await settingsService.getValue<number>('scanMaxDepth');
    const { directories, maxDepth = settingMaxDepth ?? 3 } = body;

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
      data: scannedProjects,
      message: `Scanned and saved ${scannedProjects.length} projects`,
    });
  } catch (error) {
    console.error('Error scanning projects:', error);
    return c.json(
      {
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
 * PATCH /api/projects/:id/favorite
 * Toggle project favorite status
 */
projects.patch('/:id/favorite', async c => {
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
 * PATCH /api/projects/:id/archive
 * Archive a project (sets archivedAt to current timestamp)
 */
projects.patch('/:id/archive', async c => {
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
 * PATCH /api/projects/:id/unarchive
 * Unarchive a project (sets archivedAt to null)
 */
projects.patch('/:id/unarchive', async c => {
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

/**
 * GET /api/projects/technologies
 * Get all available technologies
 */
projects.get('/meta/technologies', async c => {
  try {
    const techs = await projectService.getTechnologies();

    return c.json({
      data: techs,
    });
  } catch (error) {
    console.error('Error fetching technologies:', error);
    return c.json(
      {
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
      data: ides,
    });
  } catch (error) {
    console.error('Error detecting IDEs:', error);
    return c.json(
      {
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
      data: ides,
    });
  } catch (error) {
    console.error('Error fetching available IDEs:', error);
    return c.json(
      {
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
      message: 'Preferred IDE updated successfully',
    });
  } catch (error) {
    console.error('Error updating preferred IDE:', error);
    return c.json(
      {
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
      message: 'Project opened in IDE',
    });
  } catch (error) {
    console.error('Error opening project:', error);
    return c.json(
      {
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
      data: terminals,
    });
  } catch (error) {
    console.error('Error detecting terminals:', error);
    return c.json(
      {
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
      data: terminals,
    });
  } catch (error) {
    console.error('Error fetching available terminals:', error);
    return c.json(
      {
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
      message: 'Preferred terminal updated successfully',
    });
  } catch (error) {
    console.error('Error updating preferred terminal:', error);
    return c.json(
      {
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
      message: 'Terminal opened at project path',
    });
  } catch (error) {
    console.error('Error opening terminal:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to open terminal',
      },
      500
    );
  }
});

/**
 * GET /api/projects/:id/readme
 * Get the README.md file content for a project
 */
projects.get('/:id/readme', async c => {
  try {
    const id = c.req.param('id');
    const readme = await projectService.getProjectReadme(id);

    if (!readme) {
      return c.json(
        {
          error: 'README.md not found',
        },
        404
      );
    }

    return c.json({
      data: readme,
    });
  } catch (error) {
    console.error('Error fetching README:', error);
    return c.json(
      {
        error: 'Failed to fetch README',
      },
      500
    );
  }
});

/**
 * GET /api/projects/:id/package-scripts
 * Get package.json scripts for a project
 */
projects.get('/:id/package-scripts', async c => {
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

    const packageJsonPath = path.join(project.path, 'package.json');

    try {
      const fs = await import('fs/promises');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

      return c.json({
        data: packageJson.scripts || {},
      });
    } catch {
      return c.json({
        data: {},
      });
    }
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
 * GET /api/projects/:id/composer-scripts
 * Get composer.json scripts for a project
 */
projects.get('/:id/composer-scripts', async c => {
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

    const composerJsonPath = path.join(project.path, 'composer.json');

    try {
      const fs = await import('fs/promises');
      const composerJson = JSON.parse(await fs.readFile(composerJsonPath, 'utf-8'));

      return c.json({
        data: composerJson.scripts || {},
      });
    } catch {
      return c.json({
        data: {},
      });
    }
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
 * GET /api/projects/:id/icon
 * Serve the project icon file
 */
projects.get('/:id/icon', async c => {
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

    if (!project.icon) {
      return c.json(
        {
          error: 'No icon found for this project',
        },
        404
      );
    }

    const fs = await import('fs/promises');
    const iconPath = path.join(project.path, project.icon);

    try {
      const iconData = await fs.readFile(iconPath);
      const ext = path.extname(project.icon).toLowerCase();

      // Set appropriate content type based on file extension
      const contentType =
        {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.svg': 'image/svg+xml',
          '.ico': 'image/x-icon',
        }[ext] || 'application/octet-stream';

      return new Response(new Uint8Array(iconData), {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
        },
      });
    } catch {
      return c.json(
        {
          error: 'Icon file not found',
        },
        404
      );
    }
  } catch (error) {
    console.error('Error serving project icon:', error);
    return c.json(
      {
        error: 'Failed to serve project icon',
      },
      500
    );
  }
});

/**
 * POST /api/projects/:id/delete-packages
 * Delete third-party packages from a project
 */
projects.post('/:id/delete-packages', async c => {
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

/**
 * PATCH /api/projects/:id/start-processes
 * Update the start processes configuration for a project
 */
projects.patch('/:id/start-processes', async c => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { startProcesses } = body;

    // Validate that startProcesses is an array
    if (!Array.isArray(startProcesses)) {
      return c.json(
        {
          error: 'startProcesses must be an array',
        },
        400
      );
    }

    // Update the project with the new start processes
    await projectService.updateStartProcesses(id, startProcesses);

    return c.json({
      message: 'Start processes updated successfully',
    });
  } catch (error) {
    console.error('Error updating start processes:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to update start processes',
      },
      500
    );
  }
});

/**
 * GET /api/projects/:id/start-processes
 * Get the start processes configuration for a project
 */
projects.get('/:id/start-processes', async c => {
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

    const processes = project.startProcesses ? JSON.parse(project.startProcesses) : [];

    return c.json({
      data: processes,
    });
  } catch (error) {
    console.error('Error fetching start processes:', error);
    return c.json(
      {
        error: 'Failed to fetch start processes',
      },
      500
    );
  }
});

/**
 * POST /api/projects/:id/start
 * Start all configured processes for a project
 */
projects.post('/:id/start', async c => {
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

    if (!project.startProcesses) {
      return c.json(
        {
          error: 'No start processes configured for this project',
        },
        400
      );
    }

    const processes: StartProcess[] = JSON.parse(project.startProcesses);
    const status = await processManagerService.startProjectProcesses(id, project.path, processes);

    return c.json({
      data: status,
      message: 'Started project processes',
    });
  } catch (error) {
    console.error('Error starting project processes:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to start project processes',
      },
      500
    );
  }
});

/**
 * POST /api/projects/:id/stop
 * Stop all running processes for a project
 */
projects.post('/:id/stop', async c => {
  try {
    const id = c.req.param('id');
    await processManagerService.stopProjectProcesses(id);

    return c.json({
      message: 'Stopped all project processes',
    });
  } catch (error) {
    console.error('Error stopping project processes:', error);
    return c.json(
      {
        error: 'Failed to stop project processes',
      },
      500
    );
  }
});

/**
 * GET /api/projects/process-status?projectId=<id>
 * Get the status of running processes
 * - Without projectId: returns all processes across all projects
 * - With projectId: returns processes for that specific project
 */
projects.get('/process-status', async c => {
  try {
    const projectId = c.req.query('projectId');

    if (projectId) {
      // Return status for specific project
      const status = processManagerService.getProcessStatus(projectId);
      return c.json({
        data: status,
      });
    } else {
      // Return status for all projects
      const allStatuses = processManagerService.getAllProcessStatuses();
      return c.json({
        data: allStatuses,
      });
    }
  } catch (error) {
    console.error('Error fetching process status:', error);
    return c.json(
      {
        error: 'Failed to fetch process status',
      },
      500
    );
  }
});

/**
 * POST /api/projects/:id/processes/:processId/stop
 * Stop a specific process for a project
 */
projects.post('/:id/processes/:processId/stop', async c => {
  try {
    const id = c.req.param('id');
    const processId = c.req.param('processId');

    await processManagerService.stopProcess(id, processId);

    return c.json({
      message: 'Process stopped successfully',
    });
  } catch (error) {
    console.error('Error stopping process:', error);
    return c.json(
      {
        error: 'Failed to stop process',
      },
      500
    );
  }
});

/**
 * GET /api/projects/:id/processes/:processId/output
 * Get the output from a specific process
 */
projects.get('/:id/processes/:processId/output', async c => {
  try {
    const id = c.req.param('id');
    const processId = c.req.param('processId');

    const output = processManagerService.getProcessOutput(id, processId);

    if (output === null) {
      return c.json(
        {
          error: 'Process not found',
        },
        404
      );
    }

    return c.json({
      data: {
        output: output.join(''),
        lines: output,
      },
    });
  } catch (error) {
    console.error('Error fetching process output:', error);
    return c.json(
      {
        error: 'Failed to fetch process output',
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

export default projects;
