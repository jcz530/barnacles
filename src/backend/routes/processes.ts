import { Hono } from 'hono';
import { processManagerService } from '../services/process-manager-service';

const processes = new Hono();

/**
 * GET /api/processes
 * Get all processes across all projects
 */
processes.get('/', async c => {
  try {
    const projectId = c.req.query('projectId');

    if (projectId) {
      // Return processes for a specific project
      const projectStatus = processManagerService.getProcessStatus(projectId);
      return c.json({
        data: projectStatus.processes,
      });
    } else {
      // Return all processes
      const allProcesses = processManagerService.getAllProcesses();
      return c.json({
        data: allProcesses,
      });
    }
  } catch (error) {
    console.error('Error fetching processes:', error);
    return c.json(
      {
        error: 'Failed to fetch processes',
      },
      500
    );
  }
});

/**
 * POST /api/processes
 * Create a new ad-hoc process
 */
processes.post('/', async c => {
  try {
    const body = await c.req.json();
    const { projectId, cwd, command, title } = body;

    const process = await processManagerService.createProcess({
      projectId,
      cwd,
      command,
      title,
    });

    return c.json({
      data: process,
      message: 'Process created successfully',
    });
  } catch (error) {
    console.error('Error creating process:', error);
    return c.json(
      {
        error: 'Failed to create process',
      },
      500
    );
  }
});

/**
 * GET /api/processes/:id
 * Get a specific process by ID
 */
processes.get('/:id', async c => {
  try {
    const id = c.req.param('id');
    const process = processManagerService.getProcess(id);

    if (!process) {
      return c.json(
        {
          error: 'Process not found',
        },
        404
      );
    }

    return c.json({
      data: process,
    });
  } catch (error) {
    console.error('Error fetching process:', error);
    return c.json(
      {
        error: 'Failed to fetch process',
      },
      500
    );
  }
});

/**
 * DELETE /api/processes/:id
 * Kill a specific process
 */
processes.delete('/:id', async c => {
  try {
    const id = c.req.param('id');
    const success = await processManagerService.killProcess(id);

    if (!success) {
      return c.json(
        {
          error: 'Process not found',
        },
        404
      );
    }

    return c.json({
      message: 'Process killed successfully',
    });
  } catch (error) {
    console.error('Error killing process:', error);
    return c.json(
      {
        error: 'Failed to kill process',
      },
      500
    );
  }
});

/**
 * GET /api/processes/:id/output
 * Get output from a specific process
 */
processes.get('/:id/output', async c => {
  try {
    const id = c.req.param('id');
    const output = processManagerService.getProcessOutputById(id);

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
