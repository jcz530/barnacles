import { Hono } from 'hono';
import dayjs from 'dayjs';
import { BadRequestException } from '../../exceptions/http-exceptions';
import { projectService } from '../../services/project';
import {
  isoWeeksInYearFor,
  parseIsoWeek,
  projectGitStatsService,
} from '../../services/project/project-git-stats-service';
import { settingsService } from '../../services/settings-service';

const gitStats = new Hono();

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
// ISO week, e.g. 2026-W33. Weeks 00 and 54+ are rejected by the shape; whether
// 53 exists depends on the year, which is checked below.
const WEEK_PATTERN = /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/;
// Bounded below by git's own history: nothing predates the tool itself.
const YEAR_PATTERN = /^(19[7-9]\d|2\d{3})$/;
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
 *   period    week | month | last-week (default week); ignored when an explicit
 *             week/month/year is set
 *   year      YYYY, for the Stats page's year view
 *   month     YYYY-MM, for month-by-month navigation; takes precedence over year
 *   week      YYYY-Www ISO week; takes precedence over month
 *   projectId restrict to specific projects; repeat the param to select several,
 *             omit it to aggregate every non-archived project
 *   detail    'full' to include top files, languages, per-project and streaks
 */
gitStats.get('/git-stats', async c => {
  const month = c.req.query('month');
  const week = c.req.query('week');
  const year = c.req.query('year');
  // queries() rather than query(): the Stats page's filter repeats this param
  // once per selected project.
  const projectIds = c.req.queries('projectId') ?? [];
  const detail = c.req.query('detail') === 'full';

  if (week !== undefined) {
    if (!WEEK_PATTERN.test(week)) {
      throw new BadRequestException(`Invalid week "${week}". Expected YYYY-Www.`, 'INVALID_WEEK');
    }

    // Week 53 only exists in long years, so reject it elsewhere rather than
    // silently resolving to week 1 of the next year.
    const [yearPart, weekPart] = week.split('-W');
    if (Number(weekPart) > isoWeeksInYearFor(Number(yearPart))) {
      throw new BadRequestException(
        `Week ${week} does not exist; ${yearPart} has ${isoWeeksInYearFor(Number(yearPart))} weeks.`,
        'INVALID_WEEK'
      );
    }

    if (parseIsoWeek(week).isAfter(dayjs(), 'day')) {
      throw new BadRequestException(`Week ${week} is in the future.`, 'FUTURE_WEEK');
    }
  } else if (month !== undefined) {
    // Reject rather than falling back: a malformed month means the caller built
    // a bad URL, and silently returning some other range hides the bug.
    if (!MONTH_PATTERN.test(month)) {
      throw new BadRequestException(`Invalid month "${month}". Expected YYYY-MM.`, 'INVALID_MONTH');
    }

    if (dayjs(`${month}-01`).startOf('month').isAfter(dayjs(), 'month')) {
      throw new BadRequestException(`Month ${month} is in the future.`, 'FUTURE_MONTH');
    }
  } else if (year !== undefined) {
    if (!YEAR_PATTERN.test(year)) {
      throw new BadRequestException(`Invalid year "${year}". Expected YYYY.`, 'INVALID_YEAR');
    }

    if (Number(year) > dayjs().year()) {
      throw new BadRequestException(`Year ${year} is in the future.`, 'FUTURE_YEAR');
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
    week,
    year,
    additionalEmails,
    detail,
  });

  return c.json({ data: stats });
});

export default gitStats;
