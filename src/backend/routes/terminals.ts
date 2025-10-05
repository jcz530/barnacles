import { Hono } from 'hono';
import { terminalService } from '../services/terminal-service';
import { projectService } from '../services/project-service';

const terminals = new Hono();

/**
 * GET /api/terminals
 * Get all terminals or filter by project
 */
terminals.get('/', async c => {
  try {
    const projectId = c.req.query('projectId');

    const terminalList = projectId
      ? terminalService.getProjectTerminals(projectId)
      : terminalService.getAllTerminals();

    return c.json({
      data: terminalList,
    });
  } catch (error) {
    console.error('Error fetching terminals:', error);
    return c.json(
      {
        error: 'Failed to fetch terminals',
      },
      500
    );
  }
});

/**
 * GET /api/terminals/:id
 * Get a specific terminal by ID
 */
terminals.get('/:id', async c => {
  try {
    const id = c.req.param('id');
    const terminal = terminalService.getTerminal(id);

    if (!terminal) {
      return c.json(
        {
          error: 'Terminal not found',
        },
        404
      );
    }

    return c.json({
      data: terminal,
    });
  } catch (error) {
    console.error('Error fetching terminal:', error);
    return c.json(
      {
        error: 'Failed to fetch terminal',
      },
      500
    );
  }
});

/**
 * POST /api/terminals
 * Create a new terminal
 */
terminals.post('/', async c => {
  try {
    const body = await c.req.json();
    const { cwd, projectId, command, title } = body;

    // If projectId is provided, verify it exists and use its path as cwd
    let workingDir = cwd;
    if (projectId) {
      const project = await projectService.getProjectById(projectId);
      if (!project) {
        return c.json(
          {
            error: 'Project not found',
          },
          404
        );
      }
      workingDir = project.path;
    }

    if (!workingDir) {
      return c.json(
        {
          error: 'Working directory (cwd) or projectId is required',
        },
        400
      );
    }

    const terminal = terminalService.createTerminal({
      cwd: workingDir,
      projectId,
      command,
      title,
    });

    return c.json(
      {
        data: terminal,
        message: 'Terminal created successfully',
      },
      201
    );
  } catch (error) {
    console.error('Error creating terminal:', error);
    return c.json(
      {
        error: 'Failed to create terminal',
      },
      500
    );
  }
});

/**
 * DELETE /api/terminals/:id
 * Kill and remove a terminal
 */
terminals.delete('/:id', async c => {
  try {
    const id = c.req.param('id');
    const success = terminalService.killTerminal(id);

    if (!success) {
      return c.json(
        {
          error: 'Terminal not found',
        },
        404
      );
    }

    return c.json({
      message: 'Terminal killed successfully',
    });
  } catch (error) {
    console.error('Error killing terminal:', error);
    return c.json(
      {
        error: 'Failed to kill terminal',
      },
      500
    );
  }
});

/**
 * POST /api/terminals/:id/write
 * Write data to a terminal
 */
terminals.post('/:id/write', async c => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { data } = body;

    if (!data) {
      return c.json(
        {
          error: 'Data is required',
        },
        400
      );
    }

    const success = terminalService.writeToTerminal(id, data);

    if (!success) {
      return c.json(
        {
          error: 'Terminal not found or has exited',
        },
        404
      );
    }

    return c.json({
      message: 'Data written to terminal',
    });
  } catch (error) {
    console.error('Error writing to terminal:', error);
    return c.json(
      {
        error: 'Failed to write to terminal',
      },
      500
    );
  }
});

/**
 * POST /api/terminals/:id/resize
 * Resize a terminal (placeholder for future PTY implementation)
 */
terminals.post('/:id/resize', async c => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { cols, rows } = body;

    if (!cols || !rows) {
      return c.json(
        {
          error: 'cols and rows are required',
        },
        400
      );
    }

    const success = terminalService.resizeTerminal(id, cols, rows);

    if (!success) {
      return c.json(
        {
          error: 'Terminal not found or has exited',
        },
        404
      );
    }

    return c.json({
      message: 'Terminal resized',
    });
  } catch (error) {
    console.error('Error resizing terminal:', error);
    return c.json(
      {
        error: 'Failed to resize terminal',
      },
      500
    );
  }
});

export default terminals;
