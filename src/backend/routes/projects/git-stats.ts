import { Hono } from 'hono';
import dayjs from 'dayjs';
import { BadRequestException } from '../../exceptions/http-exceptions';
import { projectService } from '../../services/project';
import { projectGitStatsService } from '../../services/project/project-git-stats-service';
import { settingsService } from '../../services/settings-service';

const gitStats = new Hono();

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const VALID_PERIODS = ['week', 'month', 'last-week'] as const;

/**
 * GET /git-stats
 *
 * Aggregated git stats, either for one of the dashboard's rolling periods or
 * for a specific calendar month.
 *
 * Query params:
 *   period    week | month | last-week (default week); ignored when month is set
 *   month     YYYY-MM, for the Stats page's month-by-month navigation
 *   projectId restrict to a single project instead of aggregating all of them
 *   detail    'full' to include top files, languages, per-project and streaks
 */
gitStats.get('/git-stats', async c => {
  const month = c.req.query('month');
  const projectId = c.req.query('projectId');
  const detail = c.req.query('detail') === 'full';

  if (month !== undefined) {
    // Reject rather than falling back: a malformed month means the caller built
    // a bad URL, and silently returning some other range hides the bug.
    if (!MONTH_PATTERN.test(month)) {
      throw new BadRequestException(`Invalid month "${month}". Expected YYYY-MM.`, 'INVALID_MONTH');
    }

    if (dayjs(`${month}-01`).startOf('month').isAfter(dayjs(), 'month')) {
      throw new BadRequestException(`Month ${month} is in the future.`, 'FUTURE_MONTH');
    }
  }

  const period = c.req.query('period') as (typeof VALID_PERIODS)[number] | undefined;
  const validPeriod = period && VALID_PERIODS.includes(period) ? period : 'week';

  // Resolve the project server-side so a client never supplies a filesystem
  // path that ends up as a git working directory.
  let projectPaths: string[];
  if (projectId !== undefined) {
    const project = await projectService.getProjectById(projectId);
    if (!project) {
      throw new BadRequestException(`Unknown project "${projectId}".`, 'UNKNOWN_PROJECT');
    }
    projectPaths = [project.path];
  } else {
    const projects = await projectService.getProjects({ includeArchived: false });
    projectPaths = projects.map(p => p.path);
  }

  const additionalEmails = (await settingsService.getValue<string[]>('gitEmails')) ?? [];

  const stats = await projectGitStatsService.getGitStats({
    projectPaths,
    period: validPeriod,
    month,
    additionalEmails,
    detail,
  });

  return c.json({ data: stats });
});

export default gitStats;
