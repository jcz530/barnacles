import { eq } from 'drizzle-orm';
import { db } from '../../../shared/database';
import { projectLanguageStats, projectStats } from '../../../shared/database/schema';
import type { ProjectInfo } from '../project-scanner-service';

export interface ProjectStats {
  id: string;
  projectId: string;
  fileCount?: number | null;
  directoryCount?: number | null;
  languageStats?: Record<string, { fileCount: number; percentage: number; linesOfCode: number }>;
  gitBranch?: string | null;
  gitStatus?: string | null;
  lastCommitDate?: Date | null;
  lastCommitMessage?: string | null;
  hasUncommittedChanges?: boolean | null;
}

class ProjectStatsService {
  /**
   * Get stats for a project
   */
  async getProjectStats(
    projectId: string,
    includeLanguageStats: boolean = true
  ): Promise<ProjectStats | null> {
    const result = await db
      .select()
      .from(projectStats)
      .where(eq(projectStats.projectId, projectId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    let languageStats:
      | Record<string, { fileCount: number; percentage: number; linesOfCode: number }>
      | undefined = undefined;

    // Only fetch language stats if requested
    if (includeLanguageStats) {
      // Fetch language stats from the new table
      const langStats = await db
        .select()
        .from(projectLanguageStats)
        .where(eq(projectLanguageStats.projectId, projectId));

      // Convert to the expected format for backward compatibility
      const stats: Record<string, { fileCount: number; percentage: number; linesOfCode: number }> =
        {};

      for (const stat of langStats) {
        stats[stat.technologySlug] = {
          fileCount: stat.fileCount,
          percentage: stat.percentage / 10, // Convert back from integer storage (525 -> 52.5)
          linesOfCode: stat.linesOfCode,
        };
      }

      languageStats = stats;
    }

    return {
      ...result[0],
      languageStats,
    };
  }

  /**
   * Save or update project stats
   */
  async saveProjectStats(projectId: string, projectInfo: ProjectInfo): Promise<void> {
    const existingStats = await db
      .select()
      .from(projectStats)
      .where(eq(projectStats.projectId, projectId))
      .limit(1);

    // Build stats data, only including fields that are provided
    const statsData: Partial<typeof projectStats.$inferInsert> = {
      gitBranch: projectInfo.gitInfo?.branch,
      gitStatus: projectInfo.gitInfo?.status,
      gitRemoteUrl: projectInfo.gitInfo?.remoteUrl,
      lastCommitDate: projectInfo.gitInfo?.lastCommitDate,
      lastCommitMessage: projectInfo.gitInfo?.lastCommitMessage,
      hasUncommittedChanges: projectInfo.gitInfo?.hasUncommittedChanges,
      updatedAt: new Date(),
    };

    // Only update these fields if they're provided (not undefined)
    if (projectInfo.stats.fileCount !== undefined) {
      statsData.fileCount = projectInfo.stats.fileCount;
    }
    if (projectInfo.stats.directoryCount !== undefined) {
      statsData.directoryCount = projectInfo.stats.directoryCount;
    }
    if (projectInfo.stats.linesOfCode !== undefined) {
      statsData.linesOfCode = projectInfo.stats.linesOfCode;
    }
    if (projectInfo.stats.thirdPartySize !== undefined) {
      statsData.thirdPartySize = projectInfo.stats.thirdPartySize;
    }

    if (existingStats.length > 0) {
      await db.update(projectStats).set(statsData).where(eq(projectStats.projectId, projectId));
    } else {
      await db.insert(projectStats).values({
        ...statsData,
        projectId,
      });
    }

    // Only update language stats if they're provided and not empty
    // (lightweight scans pass empty objects, so we should preserve existing data)
    const hasLanguageStats =
      projectInfo.stats.languageStats && Object.keys(projectInfo.stats.languageStats).length > 0;

    if (hasLanguageStats) {
      await this.saveLanguageStats(projectId, projectInfo.stats.languageStats);
    }
  }

  /**
   * Save language stats for a project
   */
  async saveLanguageStats(
    projectId: string,
    languageStats: Record<string, { fileCount: number; percentage: number; linesOfCode: number }>
  ): Promise<void> {
    // Delete existing language stats and insert new ones
    await db.delete(projectLanguageStats).where(eq(projectLanguageStats.projectId, projectId));

    // Insert new language stats
    for (const [techSlug, stats] of Object.entries(languageStats)) {
      await db.insert(projectLanguageStats).values({
        projectId,
        technologySlug: techSlug,
        fileCount: stats.fileCount,
        percentage: Math.round(stats.percentage * 10), // Store as integer (e.g., 52.5 -> 525)
        linesOfCode: stats.linesOfCode,
      });
    }
  }
}

export const projectStatsService = new ProjectStatsService();
