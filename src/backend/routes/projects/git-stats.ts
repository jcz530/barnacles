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
 * Ceiling on how many projects one request may span. Each id costs a database
 * lookup and then its own `git log` process, so an unbounded list is a cheap
 * way to hang the request.
 */
const MAX_PROJECT_IDS = 50;

/**
 * GET /git-stats
 *
 * Aggregated git stats, either for one of the dashboard's rolling periods or
 * for a specific calendar month.
 *
 * Query params:
 *   period    week | month | last-week (default week); ignored when month is set
 *   month     YYYY-MM, for the Stats page's month-by-month navigation
 *   projectId restrict to specific projects; repeat the param to select several,
 *             omit it to aggregate every non-archived project
 *   detail    'full' to include top files, languages, per-project and streaks
 */
gitStats.get('/git-stats', async c => {
  const month = c.req.query('month');
  // queries() rather than query(): the Stats page's filter repeats this param
  // once per selected project.
  const projectIds = c.req.queries('projectId') ?? [];
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

  // Resolve projects server-side so a client never supplies a filesystem path
  // that ends up as a git working directory.
  let projectPaths: string[];
  if (projectIds.length > 0) {
    // De-duplicate first: the same id twice would otherwise count that repo's
    // commits twice in the totals.
    const uniqueIds = [...new Set(projectIds)];

    if (uniqueIds.length > MAX_PROJECT_IDS) {
      throw new BadRequestException(
        `Too many projects requested (${uniqueIds.length}); the maximum is ${MAX_PROJECT_IDS}.`,
        'TOO_MANY_PROJECTS'
      );
    }

    const projects = await Promise.all(uniqueIds.map(id => projectService.getProjectById(id)));

    projectPaths = projects.map((project, index) => {
      if (!project) {
        throw new BadRequestException(`Unknown project "${uniqueIds[index]}".`, 'UNKNOWN_PROJECT');
      }
      return project.path;
    });
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
