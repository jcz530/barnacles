import { Hono } from 'hono';
import { projectService } from '../../services/project';
import { projectGitStatsService } from '../../services/project/project-git-stats-service';

const gitStats = new Hono();

/**
 * GET /git-stats
 * Get aggregated git stats across all projects for a given period
 */
gitStats.get('/git-stats', async c => {
  const period = c.req.query('period') as 'week' | 'month' | 'last-week' | undefined;

  // Validate period
  const validPeriod = period && ['week', 'month', 'last-week'].includes(period) ? period : 'week';

  // Get all projects (exclude archived)
  const projects = await projectService.getProjects({ includeArchived: false });

  // Extract project paths
  const projectPaths = projects.map(p => p.path);

  // Get git stats
  const stats = await projectGitStatsService.getGitStats(projectPaths, validPeriod);

  return c.json({
    data: stats,
  });
});

export default gitStats;
