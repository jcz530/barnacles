import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GitStats {
  commits: number;
  filesChanged: number;
  projectsWorkedOn: number;
  linesAdded: number;
  linesRemoved: number;
  streak: number;
  period: 'week' | 'month' | 'last-week';
}

interface ProjectGitData {
  commits: number;
  filesChanged: Set<string>;
  linesAdded: number;
  linesRemoved: number;
  commitDates: Set<string>; // YYYY-MM-DD format
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
   * Get git stats across all projects for a given period
   */
  async getGitStats(
    projectPaths: string[],
    period: 'week' | 'month' | 'last-week'
  ): Promise<GitStats> {
    const { sinceDate, untilDate } = this.getPeriodDates(period);

    // Get user info from git config
    const userEmail = await this.getUserEmail();

    const allCommitDates = new Set<string>();
    let totalCommits = 0;
    const allFilesChanged = new Set<string>();
    let totalLinesAdded = 0;
    let totalLinesRemoved = 0;
    let projectsWorkedOn = 0;

    // Process each project
    for (const projectPath of projectPaths) {
      const projectData = await this.getProjectGitData(
        projectPath,
        userEmail,
        sinceDate,
        untilDate
      );

      if (projectData && projectData.commits > 0) {
        totalCommits += projectData.commits;
        projectData.filesChanged.forEach(file => allFilesChanged.add(file));
        totalLinesAdded += projectData.linesAdded;
        totalLinesRemoved += projectData.linesRemoved;
        projectData.commitDates.forEach(date => allCommitDates.add(date));
        projectsWorkedOn++;
      }
    }

    // Calculate streak
    const streak = this.calculateStreak(allCommitDates);

    return {
      commits: totalCommits,
      filesChanged: allFilesChanged.size,
      projectsWorkedOn,
      linesAdded: totalLinesAdded,
      linesRemoved: totalLinesRemoved,
      streak,
      period,
    };
  }

  /**
   * Get git data for a single project
   */
  private async getProjectGitData(
    projectPath: string,
    userEmail: string,
    sinceDate: string,
    untilDate: string
  ): Promise<ProjectGitData | null> {
    try {
      // Check if git repo exists
      const gitDir = path.join(projectPath, '.git');
      await fs.access(gitDir);

      // Get commit count
      const { stdout: commitLog } = await execAsync(
        `git log --all --author="${userEmail}" --since="${sinceDate}" --until="${untilDate}" --format=%H`,
        { cwd: projectPath }
      );

      const commits = commitLog.trim() ? commitLog.trim().split('\n').length : 0;

      if (commits === 0) {
        return null;
      }

      // Get files changed and line stats
      const { stdout: numstatLog } = await execAsync(
        `git log --all --author="${userEmail}" --since="${sinceDate}" --until="${untilDate}" --numstat --format=%H`,
        { cwd: projectPath }
      );

      const filesChanged = new Set<string>();
      let linesAdded = 0;
      let linesRemoved = 0;

      const lines = numstatLog.split('\n');
      for (const line of lines) {
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
            linesAdded += parseInt(added, 10) || 0;
            linesRemoved += parseInt(removed, 10) || 0;
            filesChanged.add(file);
          }
        }
      }

      // Get commit dates for streak calculation
      const { stdout: commitDates } = await execAsync(
        `git log --all --author="${userEmail}" --since="${sinceDate}" --until="${untilDate}" --format=%as`,
        { cwd: projectPath }
      );

      const commitDatesSet = new Set<string>();
      if (commitDates.trim()) {
        commitDates
          .trim()
          .split('\n')
          .forEach(date => commitDatesSet.add(date));
      }

      return {
        commits,
        filesChanged,
        linesAdded,
        linesRemoved,
        commitDates: commitDatesSet,
      };
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
   * Calculate streak of consecutive days with commits
   */
  private calculateStreak(commitDates: Set<string>): number {
    if (commitDates.size === 0) {
      return 0;
    }

    // Sort dates in descending order (newest first)
    const sortedDates = Array.from(commitDates).sort().reverse();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if most recent commit was today or yesterday
    const mostRecentDate = new Date(sortedDates[0]);
    mostRecentDate.setHours(0, 0, 0, 0);

    const daysSinceLastCommit = Math.floor(
      (today.getTime() - mostRecentDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Streak is broken if last commit was more than 1 day ago
    if (daysSinceLastCommit > 1) {
      return 0;
    }

    // Count consecutive days working backwards from most recent
    let streak = 1;
    let currentDate = new Date(mostRecentDate);

    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = new Date(sortedDates[i]);
      prevDate.setHours(0, 0, 0, 0);

      const expectedDate = new Date(currentDate);
      expectedDate.setDate(expectedDate.getDate() - 1);

      if (prevDate.getTime() === expectedDate.getTime()) {
        streak++;
        currentDate = prevDate;
      } else if (prevDate.getTime() < expectedDate.getTime()) {
        // Gap found, stop counting
        break;
      }
      // If same date, continue (multiple commits same day)
    }

    return streak;
  }

  /**
   * Get date range for the period
   */
  private getPeriodDates(period: 'week' | 'month' | 'last-week'): {
    sinceDate: string;
    untilDate: string;
  } {
    const now = new Date();
    now.setHours(23, 59, 59, 999);

    let sinceDate: Date;
    let untilDate: Date = now;

    switch (period) {
      case 'week': {
        // This week (Monday to today)
        const today = new Date(now);
        const dayOfWeek = today.getDay();
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        sinceDate = new Date(today);
        sinceDate.setDate(today.getDate() - daysToMonday);
        sinceDate.setHours(0, 0, 0, 0);
        break;
      }
      case 'last-week': {
        // Last week (Monday to Sunday)
        const today = new Date(now);
        const dayOfWeek = today.getDay();
        const daysToLastMonday = dayOfWeek === 0 ? 13 : dayOfWeek + 6;
        sinceDate = new Date(today);
        sinceDate.setDate(today.getDate() - daysToLastMonday);
        sinceDate.setHours(0, 0, 0, 0);

        untilDate = new Date(sinceDate);
        untilDate.setDate(sinceDate.getDate() + 6);
        untilDate.setHours(23, 59, 59, 999);
        break;
      }
      case 'month': {
        // This month (1st to today)
        sinceDate = new Date(now.getFullYear(), now.getMonth(), 1);
        sinceDate.setHours(0, 0, 0, 0);
        break;
      }
    }

    return {
      sinceDate: sinceDate.toISOString().split('T')[0],
      untilDate: untilDate.toISOString().split('T')[0],
    };
  }
}

export const projectGitStatsService = new ProjectGitStatsService();
