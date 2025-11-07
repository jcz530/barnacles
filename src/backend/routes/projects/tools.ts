import { Hono } from 'hono';
import { projectService } from '../../services/project-service';
import { loadProject } from '../../middleware/project-loader';
import type { ProjectContext } from '../../types/hono';

const tools = new Hono();

/**
 * GET /ides/detected
 * Get all detected IDEs on the system
 */
tools.get('/ides/detected', async c => {
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
 * GET /ides/available
 * Get all available IDE definitions
 */
tools.get('/ides/available', async c => {
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
 * PATCH /:id/ide
 * Update the preferred IDE for a project
 */
tools.patch('/:id/ide', loadProject, async (c: ProjectContext) => {
  try {
    const project = c.get('project');
    const body = await c.req.json();
    const { ideId } = body;

    await projectService.updatePreferredIDE(project.id, ideId);

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
 * POST /:id/open
 * Open a project in its preferred IDE
 */
tools.post('/:id/open', loadProject, async (c: ProjectContext) => {
  try {
    const project = c.get('project');
    const body = await c.req.json().catch(() => ({}));
    const { ideId } = body;

    await projectService.openProjectInIDE(project.id, ideId);

    return c.json({
      message: 'Project opened in IDE',
    });
  } catch (error) {
    console.error('Error opening project:', error);

    // Check if this is a permission error and return structured response
    if (error instanceof Error && error.name === 'PermissionError') {
      return c.json(
        {
          error: error.message,
          code: (error as any).code,
          targetApp: (error as any).targetApp,
          instructions: (error as any).instructions,
        },
        403
      );
    }

    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to open project in IDE',
      },
      500
    );
  }
});

/**
 * GET /terminals/detected
 * Get all detected terminals on the system
 */
tools.get('/terminals/detected', async c => {
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
 * GET /terminals/available
 * Get all available terminal definitions
 */
tools.get('/terminals/available', async c => {
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
 * PATCH /:id/terminal
 * Update the preferred terminal for a project
 */
tools.patch('/:id/terminal', loadProject, async (c: ProjectContext) => {
  try {
    const project = c.get('project');
    const body = await c.req.json();
    const { terminalId } = body;

    await projectService.updatePreferredTerminal(project.id, terminalId);

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
 * POST /:id/open-terminal
 * Open a terminal at the project path
 */
tools.post('/:id/open-terminal', loadProject, async (c: ProjectContext) => {
  try {
    const project = c.get('project');
    const body = await c.req.json().catch(() => ({}));
    const { terminalId } = body;

    await projectService.openTerminalAtProject(project.id, terminalId);

    return c.json({
      message: 'Terminal opened at project path',
    });
  } catch (error) {
    console.error('Error opening terminal:', error);

    // Check if this is a permission error and return structured response
    if (error instanceof Error && error.name === 'PermissionError') {
      return c.json(
        {
          error: error.message,
          code: (error as any).code,
          targetApp: (error as any).targetApp,
          instructions: (error as any).instructions,
        },
        403
      );
    }

    return c.json(
      {
        error: error instanceof Error ? error.message : 'Failed to open terminal',
      },
      500
    );
  }
});

export default tools;
