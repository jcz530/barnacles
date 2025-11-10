import { Hono } from 'hono';
import { processManagerService } from '../services/process-manager-service';
import { loadProcess, type ProcessContext } from '../middleware/process-loader';

const processes = new Hono();

/**
 * GET /api/processes
 * Get all processes across all projects
 */
processes.get('/', async c => {
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
});

/**
 * POST /api/processes
 * Create a new ad-hoc process
 */
processes.post('/', async c => {
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
});

/**
 * GET /api/processes/:id
 * Get a specific process by ID
 */
processes.get('/:id', loadProcess, async (c: ProcessContext) => {
  const process = c.get('process');

  return c.json({
    data: process,
  });
});

/**
 * DELETE /api/processes/:id
 * Kill a specific process
 */
processes.delete('/:id', loadProcess, async (c: ProcessContext) => {
  const process = c.get('process');
  await processManagerService.killProcess(process.processId);

  return c.json({
    message: 'Process killed successfully',
  });
});

/**
 * GET /api/processes/:id/output
 * Get output from a specific process
 */
processes.get('/:id/output', loadProcess, async (c: ProcessContext) => {
  const process = c.get('process');
  const output = processManagerService.getProcessOutputById(process.processId);

  return c.json({
    data: {
      output: output.join(''),
      lines: output,
    },
  });
});

export default processes;
