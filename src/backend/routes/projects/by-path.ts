import { Hono } from 'hono';
import { projectService } from '../../services/project';

const byPath = new Hono();

/**
 * GET /meta/by-path
 * Find the project whose root path matches or contains the given path
 */
byPath.get('/meta/by-path', async c => {
  const path = c.req.query('path');

  if (!path) {
    return c.json({ error: 'path query parameter is required' }, 400);
  }

  const project = await projectService.getProjectByPath(path);

  if (!project) {
    return c.json({ error: `No project found containing path "${path}"` }, 404);
  }

  return c.json({
    data: project,
  });
});

export default byPath;
