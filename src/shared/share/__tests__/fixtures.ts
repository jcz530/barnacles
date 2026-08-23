import type { GitStats } from '../../types/api';
import type { ShareContext } from '../share-model';

/**
 * Hand-written stats for a 31-day month, so text snapshots stay byte-stable.
 * Deliberately not generated and never derived from live data.
 */

const DAILY_COMMITS = [
  4, 7, 0, 3, 12, 5, 2, 8, 9, 15, 6, 4, 0, 0, 11, 13, 7, 3, 5, 9, 14, 6, 2, 0, 8, 10, 4, 7, 12, 5,
  8,
];

export function makeStats(overrides: Partial<GitStats> = {}): GitStats {
  const days = DAILY_COMMITS.map((commits, index) => ({
    date: `2025-03-${String(index + 1).padStart(2, '0')}`,
    commits,
    filesChanged: commits * 2,
    linesAdded: commits * 90,
    linesRemoved: commits * 35,
    projectsWorkedOn: commits > 0 ? 2 : 0,
  }));

  const commits = DAILY_COMMITS.reduce((sum, value) => sum + value, 0);
  const activeDays = DAILY_COMMITS.filter(value => value > 0).length;
  const linesAdded = commits * 90;
  const linesRemoved = commits * 35;

  return {
    days,
    period: 'custom-month',
    range: { since: '2025-03-01', until: '2025-03-31', month: '2025-03' },
    totals: {
      commits,
      filesChanged: 214,
      linesAdded,
      linesRemoved,
      projectsWorkedOn: 5,
      netLines: linesAdded - linesRemoved,
      churn: linesAdded + linesRemoved,
      activeDays,
    },
    detail: {
      topFiles: [],
      languages: [
        {
          slug: 'typescript',
          label: 'TypeScript',
          color: '#3178c6',
          linesChanged: 12000,
          filesChanged: 120,
          percentage: 58,
        },
        {
          slug: 'vue',
          label: 'Vue',
          color: '#41b883',
          linesChanged: 5600,
          filesChanged: 48,
          percentage: 27,
        },
        {
          slug: 'css',
          label: 'CSS',
          color: '#563d7c',
          linesChanged: 1900,
          filesChanged: 20,
          percentage: 9,
        },
      ],
      busiestDay: { date: '2025-03-10', commits: 15 },
      perProject: [
        {
          projectPath: '/Users/dev/code/barnacles',
          commits: 69,
          filesChanged: 90,
          linesAdded: 6200,
          linesRemoved: 2400,
        },
        {
          projectPath: '/Users/dev/code/dotfiles',
          commits: 37,
          filesChanged: 50,
          linesAdded: 3100,
          linesRemoved: 1200,
        },
        {
          projectPath: '/Users/dev/code/site',
          commits: 25,
          filesChanged: 40,
          linesAdded: 2000,
          linesRemoved: 900,
        },
        {
          projectPath: '/Users/dev/code/notes',
          commits: 20,
          filesChanged: 22,
          linesAdded: 900,
          linesRemoved: 300,
        },
      ],
      streaks: {
        current: 0,
        longest: 12,
        longestStart: '2025-03-15',
        longestEnd: '2025-03-26',
        warning: false,
      },
    },
    ...overrides,
  };
}

export function makeEmptyStats(): GitStats {
  const days = Array.from({ length: 31 }, (_, index) => ({
    date: `2025-03-${String(index + 1).padStart(2, '0')}`,
    commits: 0,
    filesChanged: 0,
    linesAdded: 0,
    linesRemoved: 0,
    projectsWorkedOn: 0,
  }));

  return {
    days,
    period: 'custom-month',
    range: { since: '2025-03-01', until: '2025-03-31', month: '2025-03' },
    totals: {
      commits: 0,
      filesChanged: 0,
      linesAdded: 0,
      linesRemoved: 0,
      projectsWorkedOn: 0,
      netLines: 0,
      churn: 0,
      activeDays: 0,
    },
    detail: {
      topFiles: [],
      languages: [],
      busiestDay: null,
      perProject: [],
      streaks: { current: 0, longest: 0, warning: false },
    },
  };
}

export const CONTEXT: ShareContext = {
  periodLabel: 'March 2025',
  granularity: 'month',
  selectedProjects: [],
  allProjects: [
    { path: '/Users/dev/code/barnacles', name: 'barnacles' },
    { path: '/Users/dev/code/dotfiles', name: 'dotfiles' },
    { path: '/Users/dev/code/site', name: 'site' },
    { path: '/Users/dev/code/notes', name: 'notes' },
  ],
};
