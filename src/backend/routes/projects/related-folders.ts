import { Hono } from 'hono';
import { projectService } from '../../services/project-service';

const relatedFolders = new Hono();

/**
 * GET /:id/related-folders
 * Get all related folders for a project
 */
relatedFolders.get('/:id/related-folders', async c => {
  try {
    const id = c.req.param('id');
    const folders = await projectService.getRelatedFolders(id);

    return c.json({
      data: folders,
    });
  } catch (error) {
    console.error('Error fetching related folders:', error);
    return c.json(
      {
        error: 'Failed to fetch related folders',
      },
      500
    );
  }
});

/**
 * POST /:id/related-folders
 * Add a related folder to a project
 */
relatedFolders.post('/:id/related-folders', async c => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { folderPath } = body;

    if (!folderPath) {
      return c.json(
        {
          error: 'folderPath is required',
        },
        400
      );
    }

    const result = await projectService.addRelatedFolder(id, folderPath);

    if (!result.success) {
      return c.json(
        {
          error: result.error,
        },
        400
      );
    }

    return c.json({
      data: result.folder,
    });
  } catch (error) {
    console.error('Error adding related folder:', error);
    return c.json(
      {
        error: 'Failed to add related folder',
      },
      500
    );
  }
});

/**
 * DELETE /:id/related-folders/:folderId
 * Remove a related folder from a project
 */
relatedFolders.delete('/:id/related-folders/:folderId', async c => {
  try {
    const folderId = c.req.param('folderId');
    const result = await projectService.removeRelatedFolder(folderId);

    return c.json({
      success: result.success,
    });
  } catch (error) {
    console.error('Error removing related folder:', error);
    return c.json(
      {
        error: 'Failed to remove related folder',
      },
      500
    );
  }
});

export default relatedFolders;
