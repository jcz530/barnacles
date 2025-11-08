import { Hono } from 'hono';
import { projectService } from '../../services/project-service';
import { loadProject } from '../../middleware/project-loader';
import type { ProjectContext } from '../../types/hono';
import { BadRequestException } from '../../exceptions/http-exceptions';

const relatedFolders = new Hono();

/**
 * GET /:id/related-folders
 * Get all related folders for a project
 */
relatedFolders.get('/:id/related-folders', loadProject, async (c: ProjectContext) => {
  const project = c.get('project');
  const folders = await projectService.getRelatedFolders(project.id);

  return c.json({
    data: folders,
  });
});

/**
 * POST /:id/related-folders
 * Add a related folder to a project
 */
relatedFolders.post('/:id/related-folders', loadProject, async (c: ProjectContext) => {
  const project = c.get('project');
  const body = await c.req.json();
  const { folderPath } = body;

  if (!folderPath) {
    throw new BadRequestException('folderPath is required');
  }

  const result = await projectService.addRelatedFolder(project.id, folderPath);

  if (!result.success) {
    throw new BadRequestException(result.error || 'Failed to add related folder');
  }

  return c.json({
    data: result.folder,
  });
});

/**
 * DELETE /:id/related-folders/:folderId
 * Remove a related folder from a project
 */
relatedFolders.delete('/:id/related-folders/:folderId', async c => {
  const folderId = c.req.param('folderId');
  const result = await projectService.removeRelatedFolder(folderId);

  return c.json({
    success: result.success,
  });
});

export default relatedFolders;
