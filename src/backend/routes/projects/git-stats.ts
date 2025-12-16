import { Hono } from 'hono';
import { projectService } from '../../services/project';
import { projectGitStatsService } from '../../services/project/project-git-stats-service';
import { settingsService } from '../../services/settings-service';

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

  // Get additional emails from settings
  const additionalEmails = (await settingsService.getValue<string[]>('gitEmails')) ?? [];

  // Get git stats
  const stats = await projectGitStatsService.getGitStats(
    projectPaths,
    validPeriod,
    additionalEmails
  );

  return c.json({
    data: stats,
  });
});

export default gitStats;
