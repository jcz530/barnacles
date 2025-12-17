import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUnitTestContext, mockDatabaseForUnit } from '@test/contexts';
import { projectExclusionsService } from '@backend/services/project/project-exclusions-service';
import { db } from '@shared/database';
import { projectExclusions, projects } from '@shared/database/schema';

// Mock the database connection module
mockDatabaseForUnit();

describe('ProjectExclusionsService', () => {
  const context = createUnitTestContext();

  beforeEach(async () => {
    await context.setup();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await context.teardown();
  });

  describe('getExclusions', () => {
    it('should return exclusions for a project', async () => {
      const projectId = 'test-project-123';

      // Create project first
      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      // Insert some exclusions
      await db.insert(projectExclusions).values([
        {
          id: 'excl-1',
          projectId,
          path: 'node_modules',
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'excl-2',
          projectId,
          path: 'dist',
          createdAt: new Date('2024-01-02'),
        },
      ]);

      const result = await projectExclusionsService.getExclusions(projectId);

      expect(result).toHaveLength(2);
      expect(result.map(e => e.path)).toContain('node_modules');
      expect(result.map(e => e.path)).toContain('dist');
    });

    it('should return empty array for project with no exclusions', async () => {
      const result = await projectExclusionsService.getExclusions('nonexistent-project');
      expect(result).toHaveLength(0);
    });

    it('should return exclusions ordered by path', async () => {
      const projectId = 'test-order-project';

      // Create project first
      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      // Insert exclusions in non-alphabetical order
      await db.insert(projectExclusions).values([
        {
          id: 'excl-1',
          projectId,
          path: 'vendor',
          createdAt: new Date(),
        },
        {
          id: 'excl-2',
          projectId,
          path: 'build',
          createdAt: new Date(),
        },
        {
          id: 'excl-3',
          projectId,
          path: 'dist',
          createdAt: new Date(),
        },
      ]);

      const result = await projectExclusionsService.getExclusions(projectId);

      expect(result).toHaveLength(3);
      expect(result[0].path).toBe('build');
      expect(result[1].path).toBe('dist');
      expect(result[2].path).toBe('vendor');
    });

    it('should only return exclusions for the specified project', async () => {
      const projectId1 = 'project-1';
      const projectId2 = 'project-2';

      // Create projects
      await db.insert(projects).values([
        { id: projectId1, name: 'Project 1', path: '/path1' },
        { id: projectId2, name: 'Project 2', path: '/path2' },
      ]);

      // Insert exclusions for both projects
      await db.insert(projectExclusions).values([
        { id: 'excl-1', projectId: projectId1, path: 'node_modules', createdAt: new Date() },
        { id: 'excl-2', projectId: projectId2, path: 'vendor', createdAt: new Date() },
      ]);

      const result1 = await projectExclusionsService.getExclusions(projectId1);
      const result2 = await projectExclusionsService.getExclusions(projectId2);

      expect(result1).toHaveLength(1);
      expect(result1[0].path).toBe('node_modules');
      expect(result2).toHaveLength(1);
      expect(result2[0].path).toBe('vendor');
    });
  });

  describe('addExclusion', () => {
    it('should add an exclusion to a project', async () => {
      const projectId = 'test-project-456';
      const path = 'src/generated';

      // Create project first
      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      const result = await projectExclusionsService.addExclusion(projectId, path);

      expect(result.success).toBe(true);
      expect(result.exclusion).toBeDefined();
      expect(result.exclusion?.path).toBe(path);
      expect(result.exclusion?.projectId).toBe(projectId);

      // Verify it was added to database
      const saved = await projectExclusionsService.getExclusions(projectId);
      expect(saved).toHaveLength(1);
      expect(saved[0].path).toBe(path);
    });

    it('should normalize paths by removing leading slashes', async () => {
      const projectId = 'test-normalize-leading';

      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      const result = await projectExclusionsService.addExclusion(projectId, '/dist');

      expect(result.success).toBe(true);
      expect(result.exclusion?.path).toBe('dist');
    });

    it('should normalize paths by removing trailing slashes', async () => {
      const projectId = 'test-normalize-trailing';

      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      const result = await projectExclusionsService.addExclusion(projectId, 'dist/');

      expect(result.success).toBe(true);
      expect(result.exclusion?.path).toBe('dist');
    });

    it('should normalize paths by removing both leading and trailing slashes', async () => {
      const projectId = 'test-normalize-both';

      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      const result = await projectExclusionsService.addExclusion(projectId, '///dist///');

      expect(result.success).toBe(true);
      expect(result.exclusion?.path).toBe('dist');
    });

    it('should reject empty path', async () => {
      const projectId = 'test-empty-path';

      const result = await projectExclusionsService.addExclusion(projectId, '');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Path cannot be empty');
      expect(result.exclusion).toBeUndefined();
    });

    it('should reject path that becomes empty after normalization', async () => {
      const projectId = 'test-empty-normalized';

      const result = await projectExclusionsService.addExclusion(projectId, '///');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Path cannot be empty');
    });

    it('should reject duplicate exclusion paths', async () => {
      const projectId = 'test-duplicate-project';
      const path = 'node_modules';

      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      // Add exclusion first time
      await projectExclusionsService.addExclusion(projectId, path);

      // Try to add same exclusion again
      const result = await projectExclusionsService.addExclusion(projectId, path);

      expect(result.success).toBe(false);
      expect(result.error).toBe('This path is already excluded');
    });

    it('should detect duplicates after normalization', async () => {
      const projectId = 'test-normalized-duplicate';

      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      // Add with normalized path
      await projectExclusionsService.addExclusion(projectId, 'dist');

      // Try to add with slashes
      const result = await projectExclusionsService.addExclusion(projectId, '/dist/');

      expect(result.success).toBe(false);
      expect(result.error).toBe('This path is already excluded');
    });

    it('should allow same path for different projects', async () => {
      const projectId1 = 'project-1';
      const projectId2 = 'project-2';
      const path = 'node_modules';

      await db.insert(projects).values([
        { id: projectId1, name: 'Project 1', path: '/path1' },
        { id: projectId2, name: 'Project 2', path: '/path2' },
      ]);

      const result1 = await projectExclusionsService.addExclusion(projectId1, path);
      const result2 = await projectExclusionsService.addExclusion(projectId2, path);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
    });

    it('should set createdAt timestamp', async () => {
      const projectId = 'test-timestamp';
      const path = 'build';

      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      const beforeAdd = new Date();
      await new Promise(resolve => setTimeout(resolve, 10));

      const result = await projectExclusionsService.addExclusion(projectId, path);

      await new Promise(resolve => setTimeout(resolve, 10));
      const afterAdd = new Date();

      expect(result.success).toBe(true);
      expect(result.exclusion?.createdAt.getTime()).toBeGreaterThanOrEqual(beforeAdd.getTime());
      expect(result.exclusion?.createdAt.getTime()).toBeLessThanOrEqual(afterAdd.getTime());
    });
  });

  describe('removeExclusion', () => {
    it('should remove an exclusion by ID', async () => {
      const projectId = 'test-remove-project';

      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      // Add an exclusion first
      const addResult = await projectExclusionsService.addExclusion(projectId, 'dist');
      const exclusionId = addResult.exclusion!.id;

      // Verify it exists
      let exclusions = await projectExclusionsService.getExclusions(projectId);
      expect(exclusions).toHaveLength(1);

      // Remove it
      const removeResult = await projectExclusionsService.removeExclusion(exclusionId);

      expect(removeResult.success).toBe(true);
      expect(removeResult.error).toBeUndefined();

      // Verify it's gone
      exclusions = await projectExclusionsService.getExclusions(projectId);
      expect(exclusions).toHaveLength(0);
    });

    it('should succeed when removing non-existent exclusion', async () => {
      const result = await projectExclusionsService.removeExclusion('nonexistent-id');

      expect(result.success).toBe(true);
    });

    it('should only remove specified exclusion, not others', async () => {
      const projectId = 'test-selective-remove';

      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      // Add multiple exclusions
      const excl1 = await projectExclusionsService.addExclusion(projectId, 'dist');
      const excl2 = await projectExclusionsService.addExclusion(projectId, 'build');
      const excl3 = await projectExclusionsService.addExclusion(projectId, 'vendor');

      // Remove middle one
      await projectExclusionsService.removeExclusion(excl2.exclusion!.id);

      // Verify only the specified one was removed
      const remaining = await projectExclusionsService.getExclusions(projectId);
      expect(remaining).toHaveLength(2);
      expect(remaining.map(e => e.path)).toContain('dist');
      expect(remaining.map(e => e.path)).toContain('vendor');
      expect(remaining.map(e => e.path)).not.toContain('build');
    });
  });

  describe('removeExclusionByPath', () => {
    it('should remove an exclusion by project ID and path', async () => {
      const projectId = 'test-remove-by-path';

      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      // Add an exclusion
      await projectExclusionsService.addExclusion(projectId, 'dist');

      // Verify it exists
      let exclusions = await projectExclusionsService.getExclusions(projectId);
      expect(exclusions).toHaveLength(1);

      // Remove by path
      const result = await projectExclusionsService.removeExclusionByPath(projectId, 'dist');

      expect(result.success).toBe(true);

      // Verify it's gone
      exclusions = await projectExclusionsService.getExclusions(projectId);
      expect(exclusions).toHaveLength(0);
    });

    it('should normalize path when removing by path', async () => {
      const projectId = 'test-remove-normalize';

      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      // Add with normalized path
      await projectExclusionsService.addExclusion(projectId, 'dist');

      // Remove with slashes
      const result = await projectExclusionsService.removeExclusionByPath(projectId, '/dist/');

      expect(result.success).toBe(true);

      const exclusions = await projectExclusionsService.getExclusions(projectId);
      expect(exclusions).toHaveLength(0);
    });

    it('should succeed when path does not exist', async () => {
      const projectId = 'test-remove-nonexistent';

      const result = await projectExclusionsService.removeExclusionByPath(
        projectId,
        'nonexistent-path'
      );

      expect(result.success).toBe(true);
    });
  });
});
