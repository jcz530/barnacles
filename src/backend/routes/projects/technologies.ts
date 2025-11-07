import { Hono } from 'hono';
import { projectService } from '../../services/project-service';

const technologies = new Hono();

/**
 * GET /meta/technologies
 * Get all available technologies
 */
technologies.get('/meta/technologies', async c => {
  try {
    const techs = await projectService.getTechnologies();

    return c.json({
      data: techs,
    });
  } catch (error) {
    console.error('Error fetching technologies:', error);
    return c.json(
      {
        error: 'Failed to fetch technologies',
      },
      500
    );
  }
});

export default technologies;
