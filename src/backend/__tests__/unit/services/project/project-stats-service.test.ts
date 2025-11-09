import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createUnitTestContext, mockDatabaseForUnit } from '@test/contexts';
import { projectStatsService } from '@backend/services/project/project-stats-service';
import { db } from '@shared/database';
import { projectStats, projectLanguageStats, projects } from '@shared/database/schema';
import { eq } from 'drizzle-orm';
import type { ProjectInfo } from '@backend/services/project-scanner-service';

// Mock the database connection module
mockDatabaseForUnit();

describe('ProjectStatsService', () => {
  const context = createUnitTestContext();

  beforeEach(async () => {
    await context.setup();
  });

  afterEach(async () => {
    await context.teardown();
  });

  describe('getProjectStats', () => {
    it('should return null for non-existent project', async () => {
      const result = await projectStatsService.getProjectStats('nonexistent-project');
      expect(result).toBeNull();
    });

    it('should return stats without language stats when includeLanguageStats is false', async () => {
      const projectId = 'test-project-123';

      // Create project first
      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      // Create stats
      await db.insert(projectStats).values({
        projectId,
        fileCount: 100,
        directoryCount: 20,
        linesOfCode: 5000,
        gitBranch: 'main',
        gitStatus: 'clean',
      });

      // Create language stats (should be ignored)
      await db.insert(projectLanguageStats).values({
        projectId,
        technologySlug: 'typescript',
        fileCount: 50,
        percentage: 500, // 50.0%
        linesOfCode: 2500,
      });

      const result = await projectStatsService.getProjectStats(projectId, false);

      expect(result).not.toBeNull();
      expect(result?.fileCount).toBe(100);
      expect(result?.directoryCount).toBe(20);
      expect(result?.languageStats).toBeUndefined();
    });

    it('should return stats with language stats when includeLanguageStats is true', async () => {
      const projectId = 'test-project-456';

      // Create project first
      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      // Create stats
      await db.insert(projectStats).values({
        projectId,
        fileCount: 100,
        directoryCount: 20,
        linesOfCode: 5000,
      });

      // Create language stats
      await db.insert(projectLanguageStats).values([
        {
          projectId,
          technologySlug: 'typescript',
          fileCount: 50,
          percentage: 500, // 50.0%
          linesOfCode: 2500,
        },
        {
          projectId,
          technologySlug: 'vue',
          fileCount: 30,
          percentage: 300, // 30.0%
          linesOfCode: 1500,
        },
      ]);

      const result = await projectStatsService.getProjectStats(projectId, true);

      expect(result).not.toBeNull();
      expect(result?.languageStats).toBeDefined();
      expect(result?.languageStats).toHaveProperty('typescript');
      expect(result?.languageStats).toHaveProperty('vue');
      expect(result?.languageStats?.typescript).toEqual({
        fileCount: 50,
        percentage: 50.0, // Should be converted from 500
        linesOfCode: 2500,
      });
      expect(result?.languageStats?.vue).toEqual({
        fileCount: 30,
        percentage: 30.0, // Should be converted from 300
        linesOfCode: 1500,
      });
    });

    it('should include git information in stats', async () => {
      const projectId = 'test-project-789';

      // Create project first
      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      const commitDate = new Date('2024-01-15');

      await db.insert(projectStats).values({
        projectId,
        fileCount: 50,
        gitBranch: 'feature/new-stuff',
        gitStatus: 'modified',
        gitRemoteUrl: 'https://github.com/user/repo.git',
        lastCommitDate: commitDate,
        lastCommitMessage: 'Add new feature',
        hasUncommittedChanges: true,
      });

      const result = await projectStatsService.getProjectStats(projectId);

      expect(result).not.toBeNull();
      expect(result?.gitBranch).toBe('feature/new-stuff');
      expect(result?.gitStatus).toBe('modified');
      expect(result?.lastCommitMessage).toBe('Add new feature');
      expect(result?.hasUncommittedChanges).toBe(true);
    });
  });

  describe('saveProjectStats', () => {
    it('should create new stats for a project', async () => {
      const projectId = 'new-project-123';

      // Create project first
      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      const projectInfo: ProjectInfo = {
        name: 'Test Project',
        path: '/test/path',
        technologies: [],
        stats: {
          fileCount: 150,
          directoryCount: 25,
          linesOfCode: 7500,
          thirdPartySize: 1024000,
          lastModified: new Date(),
          size: 5000000,
          languageStats: {},
        },
        gitInfo: {
          branch: 'develop',
          status: 'clean',
          remoteUrl: 'https://github.com/test/repo.git',
          lastCommitDate: new Date('2024-01-20'),
          lastCommitMessage: 'Initial commit',
          hasUncommittedChanges: false,
        },
      };

      await projectStatsService.saveProjectStats(projectId, projectInfo);

      const result = await projectStatsService.getProjectStats(projectId, false);

      expect(result).not.toBeNull();
      expect(result?.fileCount).toBe(150);
      expect(result?.directoryCount).toBe(25);
      expect(result?.gitBranch).toBe('develop');
      expect(result?.gitStatus).toBe('clean');
    });

    it('should update existing stats for a project', async () => {
      const projectId = 'existing-project-456';

      // Create project first
      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      // Create initial stats
      await db.insert(projectStats).values({
        projectId,
        fileCount: 100,
        directoryCount: 20,
        gitBranch: 'main',
      });

      // Update with new info
      const projectInfo: ProjectInfo = {
        name: 'Test Project',
        path: '/test/path',
        technologies: [],
        stats: {
          fileCount: 200,
          directoryCount: 40,
          linesOfCode: 10000,
          lastModified: new Date(),
          languageStats: {},
        },
        gitInfo: {
          branch: 'feature',
          status: 'modified',
        },
      };

      await projectStatsService.saveProjectStats(projectId, projectInfo);

      const result = await projectStatsService.getProjectStats(projectId, false);

      expect(result?.fileCount).toBe(200);
      expect(result?.directoryCount).toBe(40);
      expect(result?.gitBranch).toBe('feature');
    });

    it('should save language stats when provided', async () => {
      const projectId = 'project-with-langs-789';

      // Create project first
      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      const projectInfo: ProjectInfo = {
        name: 'Test Project',
        path: '/test/path',
        technologies: [],
        stats: {
          fileCount: 100,
          lastModified: new Date(),
          languageStats: {
            typescript: { fileCount: 60, percentage: 60.0, linesOfCode: 3000 },
            javascript: { fileCount: 40, percentage: 40.0, linesOfCode: 2000 },
          },
        },
      };

      await projectStatsService.saveProjectStats(projectId, projectInfo);

      const result = await projectStatsService.getProjectStats(projectId, true);

      expect(result?.languageStats).toBeDefined();
      expect(result?.languageStats?.typescript).toEqual({
        fileCount: 60,
        percentage: 60.0,
        linesOfCode: 3000,
      });
      expect(result?.languageStats?.javascript).toEqual({
        fileCount: 40,
        percentage: 40.0,
        linesOfCode: 2000,
      });
    });

    it('should not update language stats when empty object is provided', async () => {
      const projectId = 'project-preserve-langs';

      // Create project first
      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      // Create initial language stats
      await db.insert(projectStats).values({ projectId, fileCount: 100 });
      await db.insert(projectLanguageStats).values({
        projectId,
        technologySlug: 'typescript',
        fileCount: 50,
        percentage: 500,
        linesOfCode: 2500,
      });

      // Update with empty language stats (lightweight scan)
      const projectInfo: ProjectInfo = {
        name: 'Test Project',
        path: '/test/path',
        technologies: [],
        stats: {
          fileCount: 150,
          lastModified: new Date(),
          languageStats: {}, // Empty - should preserve existing
        },
      };

      await projectStatsService.saveProjectStats(projectId, projectInfo);

      const result = await projectStatsService.getProjectStats(projectId, true);

      // Language stats should still be there
      expect(result?.languageStats).toBeDefined();
      expect(result?.languageStats?.typescript).toBeDefined();
    });
  });

  describe('saveLanguageStats', () => {
    it('should save language stats correctly', async () => {
      const projectId = 'test-lang-stats-123';

      // Create project first
      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      const languageStats = {
        typescript: { fileCount: 100, percentage: 52.5, linesOfCode: 5000 },
        vue: { fileCount: 50, percentage: 26.3, linesOfCode: 2500 },
        css: { fileCount: 40, percentage: 21.2, linesOfCode: 2000 },
      };

      await projectStatsService.saveLanguageStats(projectId, languageStats);

      // Verify they were saved
      const saved = await db
        .select()
        .from(projectLanguageStats)
        .where(eq(projectLanguageStats.projectId, projectId));

      expect(saved).toHaveLength(3);

      // Check percentage conversion (52.5 -> 525)
      const tsStats = saved.find(s => s.technologySlug === 'typescript');
      expect(tsStats?.percentage).toBe(525); // Stored as integer
      expect(tsStats?.fileCount).toBe(100);
      expect(tsStats?.linesOfCode).toBe(5000);
    });

    it('should replace existing language stats', async () => {
      const projectId = 'test-lang-replace-456';

      // Create project first
      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      // Save initial stats
      await projectStatsService.saveLanguageStats(projectId, {
        typescript: { fileCount: 50, percentage: 50.0, linesOfCode: 2500 },
      });

      // Replace with new stats
      await projectStatsService.saveLanguageStats(projectId, {
        vue: { fileCount: 100, percentage: 100.0, linesOfCode: 5000 },
      });

      const saved = await db
        .select()
        .from(projectLanguageStats)
        .where(eq(projectLanguageStats.projectId, projectId));

      expect(saved).toHaveLength(1);
      expect(saved[0].technologySlug).toBe('vue');
    });
  });
});
