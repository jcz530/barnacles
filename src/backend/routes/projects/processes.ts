import { Hono } from 'hono';
import type { StartProcess } from '../../../shared/types/process';
import { processManagerService } from '../../services/process-manager-service';
import { projectService } from '../../services/project';
import { loadProject } from '../../middleware/project-loader';
import type { ProjectContext } from '../../types/hono';
import { tailLines } from '../../utils/process-output';

const processes = new Hono();

/**
 * PATCH /:id/start-processes
 * Update the start processes configuration for a project
 */
processes.patch('/:id/start-processes', loadProject, async (c: ProjectContext) => {
  try {
    const project = c.get('project');
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
    await projectService.updateStartProcesses(project.id, startProcesses);

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
processes.get('/:id/start-processes', loadProject, async (c: ProjectContext) => {
  try {
    const project = c.get('project');
    const startProcesses: StartProcess[] = await projectService.getStartProcesses(project.id);

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
processes.post('/:id/start', loadProject, async (c: ProjectContext) => {
  try {
    const project = c.get('project');
    const startProcesses: StartProcess[] = await projectService.getStartProcesses(project.id);

    if (startProcesses.length === 0) {
      return c.json(
        {
          error: 'No start processes configured for this project',
        },
        400
      );
    }

    const status = await processManagerService.startProjectProcesses(
      project.id,
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
processes.post('/:id/stop', loadProject, async (c: ProjectContext) => {
  try {
    const project = c.get('project');
    await processManagerService.stopProjectProcesses(project.id);

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
processes.post('/:id/processes/:processId/stop', loadProject, async (c: ProjectContext) => {
  try {
    const project = c.get('project');
    const processId = c.req.param('processId');

    await processManagerService.stopProcess(project.id, processId);

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
 * Start one configured process, replacing whatever the manager holds for it.
 *
 * The stop is not redundant, and it has to complete rather than merely be
 * requested. A process that exited stays in the manager's map with status
 * 'failed' -- nothing sweeps exited processes -- and startProjectProcesses
 * skips any id already present, returning the stale status as though it had
 * started something. Without evicting first, starting a crashed process is a
 * silent no-op.
 *
 * For restart the process is usually alive, so the stop is a real kill: it is
 * awaited to completion before the replacement spawns, or the two overlap on
 * the same port. Stopping something already gone is harmless, so both start
 * and restart take the same path.
 */
const startConfiguredProcess = async (c: ProjectContext, message: string) => {
  const project = c.get('project');
  const processId = c.req.param('processId');

  const startProcesses: StartProcess[] = await projectService.getStartProcesses(project.id);
  const config = startProcesses.find(startProcess => startProcess.id === processId);

  if (!config) {
    return c.json(
      {
        error: 'Process not configured for this project',
      },
      404
    );
  }

  // Waits for the old process to actually exit, not just to be signalled: the
  // replacement would otherwise spawn while the original still held its port,
  // and a dev server that cannot bind either fails or quietly moves ports.
  const stopped = await processManagerService.stopProcessAndWait(project.id, processId);

  // A process we could not signal stays tracked, and startProjectProcesses
  // skips ids it already holds -- so starting here would spawn nothing and
  // still report success. Say so instead.
  if (!stopped) {
    return c.json(
      {
        error: 'Could not stop the running process, so it was not restarted',
      },
      500
    );
  }

  await processManagerService.startProjectProcesses(project.id, project.path, [config]);

  // The project's whole status, not what startProjectProcesses returned: that
  // reports only the processes it was handed, which a client would read as the
  // project's other processes having disappeared.
  return c.json({
    data: processManagerService.getProcessStatus(project.id),
    message,
  });
};

/**
 * POST /:id/processes/:processId/start
 * Start a single configured process, leaving the project's others alone
 */
processes.post('/:id/processes/:processId/start', loadProject, async (c: ProjectContext) => {
  try {
    return await startConfiguredProcess(c, 'Process started successfully');
  } catch (error) {
    console.error('Error starting process:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to start process',
      },
      500
    );
  }
});

/**
 * POST /:id/processes/:processId/restart
 * Stop a single configured process and start it again
 */
processes.post('/:id/processes/:processId/restart', loadProject, async (c: ProjectContext) => {
  try {
    return await startConfiguredProcess(c, 'Process restarted successfully');
  } catch (error) {
    console.error('Error restarting process:', error);
    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to restart process',
      },
      500
    );
  }
});

/**
 * GET /:id/processes/:processId/output
 * Get the output from a specific process
 */
processes.get('/:id/processes/:processId/output', loadProject, async (c: ProjectContext) => {
  try {
    const project = c.get('project');
    const processId = c.req.param('processId');

    const output = processManagerService.getProcessOutput(project.id, processId);

    if (output === null) {
      return c.json(
        {
          error: 'Process not found',
        },
        404
      );
    }

    const lines = tailLines(output, c.req.query('lines'));

    return c.json({
      data: {
        output: lines.join(''),
        lines,
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
