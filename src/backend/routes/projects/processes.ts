import { Hono } from 'hono';
import type { StartProcess } from '../../../shared/types/process';
import { processManagerService } from '../../services/process-manager-service';
import { projectService } from '../../services/project-service';

const processes = new Hono();

/**
 * PATCH /:id/start-processes
 * Update the start processes configuration for a project
 */
processes.patch('/:id/start-processes', async c => {
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
 * GET /:id/start-processes
 * Get the start processes configuration for a project
 */
processes.get('/:id/start-processes', async c => {
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

    const startProcesses: StartProcess[] = await projectService.getStartProcesses(id);

    return c.json({
      data: startProcesses,
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
 * POST /:id/start
 * Start all configured processes for a project
 */
processes.post('/:id/start', async c => {
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

    const startProcesses: StartProcess[] = await projectService.getStartProcesses(id);

    if (startProcesses.length === 0) {
      return c.json(
        {
          error: 'No start processes configured for this project',
        },
        400
      );
    }

    const status = await processManagerService.startProjectProcesses(
      id,
      project.path,
      startProcesses
    );

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
 * POST /:id/stop
 * Stop all running processes for a project
 */
processes.post('/:id/stop', async c => {
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
 * GET /process-status?projectId=<id>
 * Get the status of running processes
 * - Without projectId: returns all processes across all projects
 * - With projectId: returns processes for that specific project
 */
processes.get('/process-status', async c => {
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
 * POST /:id/processes/:processId/stop
 * Stop a specific process for a project
 */
processes.post('/:id/processes/:processId/stop', async c => {
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
 * GET /:id/processes/:processId/output
 * Get the output from a specific process
 */
processes.get('/:id/processes/:processId/output', async c => {
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

export default processes;
