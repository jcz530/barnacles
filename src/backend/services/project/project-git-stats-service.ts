import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import dayjs from 'dayjs';
import type { GitStats, GitStatsByDay, GitStatsTotals } from '@shared/types/api';

const execAsync = promisify(exec);

interface DailyProjectData {
  commits: number;
  files: Set<string>;
  linesAdded: number;
  linesRemoved: number;
}

// Files to exclude from line count stats
const EXCLUDED_FILES = [
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'Gemfile.lock',
  'Cargo.lock',
  'composer.lock',
  'poetry.lock',
  'Pipfile.lock',
];

class ProjectGitStatsService {
  /**
   * Get git stats across all projects for a given period, grouped by day
   */
  async getGitStats(
    projectPaths: string[],
    period: 'week' | 'month' | 'last-week'
  ): Promise<GitStats> {
    const { sinceDate, untilDate } = this.getPeriodDates(period);

    // Get user info from git config
    const userEmail = await this.getUserEmail();

    // Create a map of date -> daily stats
    const dailyStatsMap = new Map<string, DailyProjectData>();

    // Get all dates in the period
    const allDates = this.getDateRange(sinceDate, untilDate);
    allDates.forEach(date => {
      dailyStatsMap.set(date, {
        commits: 0,
        files: new Set<string>(),
        linesAdded: 0,
        linesRemoved: 0,
      });
    });

    // Track which projects contributed on each day
    const projectsByDay = new Map<string, Set<string>>();

    // Track all unique projects across the entire period
    const allProjects = new Set<string>();

    // Process each project
    for (const projectPath of projectPaths) {
      const projectDailyData = await this.getProjectDailyGitData(
        projectPath,
        userEmail,
        sinceDate,
        untilDate
      );

      if (projectDailyData) {
        // Merge project data into overall daily stats
        projectDailyData.forEach((data, date) => {
          const existing = dailyStatsMap.get(date);
          if (existing) {
            existing.commits += data.commits;
            data.files.forEach(file => existing.files.add(file));
            existing.linesAdded += data.linesAdded;
            existing.linesRemoved += data.linesRemoved;

            // Track this project for this day
            if (data.commits > 0) {
              if (!projectsByDay.has(date)) {
                projectsByDay.set(date, new Set());
              }
              projectsByDay.get(date)!.add(projectPath);
              allProjects.add(projectPath);
            }
          }
        });
      }
    }

    // Convert map to array of GitStatsByDay
    const days: GitStatsByDay[] = allDates.map(date => {
      const data = dailyStatsMap.get(date)!;
      return {
        date,
        commits: data.commits,
        filesChanged: data.files.size,
        linesAdded: data.linesAdded,
        linesRemoved: data.linesRemoved,
        projectsWorkedOn: projectsByDay.get(date)?.size ?? 0,
      };
    });

    // Calculate totals across all days
    const totals: GitStatsTotals = {
      commits: days.reduce((sum, day) => sum + day.commits, 0),
      filesChanged: days.reduce((sum, day) => sum + day.filesChanged, 0),
      linesAdded: days.reduce((sum, day) => sum + day.linesAdded, 0),
      linesRemoved: days.reduce((sum, day) => sum + day.linesRemoved, 0),
      projectsWorkedOn: allProjects.size,
    };

    return {
      period,
      days,
      totals,
    };
  }

  /**
   * Get git data for a single project, grouped by day
   */
  private async getProjectDailyGitData(
    projectPath: string,
    userEmail: string,
    sinceDate: string,
    untilDate: string
  ): Promise<Map<string, DailyProjectData> | null> {
    try {
      // Check if git repo exists
      const gitDir = path.join(projectPath, '.git');
      await fs.access(gitDir);

      // Get log with date, hash, and numstat in one go
      const { stdout: logOutput } = await execAsync(
        `git log --all --author="${userEmail}" --since="${sinceDate}" --until="${untilDate}" --format="%as|%H" --numstat`,
        { cwd: projectPath }
      );

      if (!logOutput.trim()) {
        return null;
      }

      const dailyData = new Map<string, DailyProjectData>();
      const lines = logOutput.split('\n');
      let currentDate: string | null = null;

      for (const line of lines) {
        if (!line.trim()) continue;

        // Check if this is a commit header line (date|hash)
        if (line.includes('|')) {
          const [date] = line.split('|');
          currentDate = date;

          // Initialize this date if not exists
          if (!dailyData.has(date)) {
            dailyData.set(date, {
              commits: 0,
              files: new Set<string>(),
              linesAdded: 0,
              linesRemoved: 0,
            });
          }

          // Increment commit count for this date
          dailyData.get(date)!.commits++;
        } else if (currentDate) {
          // This is a numstat line
          const parts = line.trim().split('\t');
          if (parts.length === 3) {
            const [added, removed, file] = parts;

            // Skip excluded files
            const fileName = path.basename(file);
            if (EXCLUDED_FILES.includes(fileName)) {
              continue;
            }

            // Skip binary files (git shows '-' for binary)
            if (added !== '-' && removed !== '-') {
              const dayData = dailyData.get(currentDate)!;
              dayData.linesAdded += parseInt(added, 10) || 0;
              dayData.linesRemoved += parseInt(removed, 10) || 0;
              dayData.files.add(file);
            }
          }
        }
      }

      return dailyData;
    } catch {
      // Not a git repo or other error, skip silently
      return null;
    }
  }

  /**
   * Get user email from git config
   */
  private async getUserEmail(): Promise<string> {
    try {
      const { stdout } = await execAsync('git config --global user.email');
      return stdout.trim();
    } catch {
      // Fallback to empty string (will match all commits)
      return '';
    }
  }

  /**
   * Get all dates in a range (inclusive)
   */
  private getDateRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    let current = dayjs(startDate);
    const end = dayjs(endDate);

    while (current.isBefore(end) || current.isSame(end, 'day')) {
      dates.push(current.format('YYYY-MM-DD'));
      current = current.add(1, 'day');
    }

    return dates;
  }

  /**
   * Get date range for the period
   */
  private getPeriodDates(period: 'week' | 'month' | 'last-week'): {
    sinceDate: string;
    untilDate: string;
  } {
    const today = dayjs();

    switch (period) {
      case 'week': {
        // This week (Monday to Sunday - always 7 days)
        const monday = today.day(1); // Get this week's Monday (or today if it's Monday)
        const sunday = monday.add(6, 'day'); // Monday + 6 = Sunday

        return {
          sinceDate: monday.format('YYYY-MM-DD'),
          untilDate: sunday.format('YYYY-MM-DD'),
        };
      }
      case 'last-week': {
        // Last week (Monday to Sunday - 7 days)
        const thisMonday = today.day(1);
        const lastMonday = thisMonday.subtract(7, 'day');
        const lastSunday = lastMonday.add(6, 'day');

        return {
          sinceDate: lastMonday.format('YYYY-MM-DD'),
          untilDate: lastSunday.format('YYYY-MM-DD'),
        };
      }
      case 'month': {
        // This month (1st to today)
        const firstDay = today.startOf('month');

        return {
          sinceDate: firstDay.format('YYYY-MM-DD'),
          untilDate: today.format('YYYY-MM-DD'),
        };
      }
    }
  }
}

export const projectGitStatsService = new ProjectGitStatsService();
