import { Hono } from 'hono';
import { projectService } from '../../services/project';
import { loadProject } from '../../middleware/project-loader';
import type { ProjectContext } from '../../types/hono';
import { PermissionError } from '../../../shared/errors/permission-error';
import { findAppBundle, getAppIconPng } from '../../services/app-icon-service';

const tools = new Hono();

/**
 * Serves the real app icon for a detected IDE or terminal.
 *
 * A 404 is the ordinary answer here, not an error: a tool whose bundle is not
 * installed has none to read an icon from, and nothing outside macOS resolves
 * at all. The frontend falls back to its glyph on any non-200, so the two
 * cases need no distinguishing.
 */
async function serveToolIcon(
  bundleNames: string[],
  cacheKey: string
): Promise<Response | { notFound: true }> {
  const bundlePath = await findAppBundle(bundleNames);
  if (!bundlePath) return { notFound: true };

  const png = await getAppIconPng(bundlePath);
  if (!png) return { notFound: true };

  // The bundle path is part of the validator: a JetBrains Toolbox update that
  // moves an IDE to a new versioned directory changes it, so the year-long
  // cache below cannot pin the previous install's icon.
  const etag = `W/"${Buffer.from(`${cacheKey}:${bundlePath}:${png.byteLength}`).toString(
    'base64url'
  )}"`;

  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Content-Length': String(png.byteLength),
      ETag: etag,
      'Cache-Control': 'public, max-age=86400',
    },
  });
}

/**
 * GET /ides/:ideId/icon
 * Serve the real app icon for an IDE
 */
tools.get('/ides/:ideId/icon', async c => {
  try {
    const ideId = c.req.param('ideId');
    const ide = projectService.getAvailableIDEs().find(i => i.id === ideId);

    if (!ide) {
      return c.json({ error: 'Unknown IDE' }, 404);
    }

    const bundleNames = ide.macAppNames ?? (ide.macAppName ? [ide.macAppName] : []);
    const result = await serveToolIcon(bundleNames, ide.id);

    if ('notFound' in result) {
      return c.json({ error: 'No icon available for this IDE' }, 404);
    }
    return result;
  } catch (error) {
    console.error('Error serving IDE icon:', error);
    return c.json({ error: 'Failed to serve IDE icon' }, 500);
  }
});

/**
 * GET /terminals/:terminalId/icon
 * Serve the real app icon for a terminal
 */
tools.get('/terminals/:terminalId/icon', async c => {
  try {
    const terminalId = c.req.param('terminalId');
    const terminal = projectService.getAvailableTerminals().find(t => t.id === terminalId);

    if (!terminal) {
      return c.json({ error: 'Unknown terminal' }, 404);
    }

    const result = await serveToolIcon(
      terminal.macAppName ? [terminal.macAppName] : [],
      terminal.id
    );

    if ('notFound' in result) {
      return c.json({ error: 'No icon available for this terminal' }, 404);
    }
    return result;
  } catch (error) {
    console.error('Error serving terminal icon:', error);
    return c.json({ error: 'Failed to serve terminal icon' }, 500);
  }
});

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
    const { ideId, worktreePath } = body;

    await projectService.openProjectInIDE(project.id, ideId, worktreePath);

    return c.json({
      message: 'Project opened in IDE',
    });
  } catch (error) {
    console.error('Error opening project:', error);

    // Check if this is a permission error and return structured response
    if (error instanceof PermissionError) {
      return c.json(
        {
          error: error.message,
          code: error.code,
          targetApp: error.targetApp,
          instructions: error.instructions,
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
    const { terminalId, worktreePath } = body;

    await projectService.openTerminalAtProject(project.id, terminalId, worktreePath);

    return c.json({
      message: 'Terminal opened at project path',
    });
  } catch (error) {
    console.error('Error opening terminal:', error);

    // Check if this is a permission error and return structured response
    if (error instanceof PermissionError) {
      return c.json(
        {
          error: error.message,
          code: error.code,
          targetApp: error.targetApp,
          instructions: error.instructions,
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
