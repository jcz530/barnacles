import { Hono } from 'hono';
import { projectService } from '../../services/project';
import { loadProject } from '../../middleware/project-loader';
import type { ProjectContext } from '../../types/hono';
import { BadRequestException } from '../../exceptions/http-exceptions';

const worktrees = new Hono();

/**
 * GET /:id/worktrees
 * Get all worktrees for a project, main checkout first
 */
worktrees.get('/:id/worktrees', loadProject, async (c: ProjectContext) => {
  const project = c.get('project');
  const projectWorktrees = await projectService.getWorktrees(project.id);

  return c.json({
    data: projectWorktrees,
  });
});

/**
 * POST /:id/worktrees/sync
 * Re-read the project's worktrees from git
 */
worktrees.post('/:id/worktrees/sync', loadProject, async (c: ProjectContext) => {
  const project = c.get('project');
  const synced = await projectService.syncWorktrees(project.id, project.path);

  return c.json({
    data: synced,
  });
});

/**
 * PATCH /:id/worktrees/:worktreeId
 * Update a worktree's preferred IDE
 */
worktrees.patch('/:id/worktrees/:worktreeId', loadProject, async (c: ProjectContext) => {
  const project = c.get('project');
  const worktreeId = c.req.param('worktreeId');
  const body = await c.req.json();
  const { preferredIde } = body;

  if (preferredIde === undefined) {
    throw new BadRequestException('preferredIde is required');
  }

  // Scope to this project: without it any worktree id could be mutated through
  // any project's URL, unlike every sibling route here.
  const owned = (await projectService.getWorktrees(project.id)).some(w => w.id === worktreeId);
  if (!owned) {
    throw new BadRequestException('Worktree not found for this project');
  }

  const result = await projectService.setWorktreePreferredIde(worktreeId, preferredIde);

  if (!result.success) {
    throw new BadRequestException(result.error || 'Failed to update worktree');
  }

  return c.json({
    success: result.success,
  });
});

export default worktrees;
