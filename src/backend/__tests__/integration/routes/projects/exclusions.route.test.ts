import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createIntegrationTestContext, mockDatabaseForIntegration } from '@test/contexts';
import { del, get, post } from '@test/helpers/api-client';
import { setupProjectRoutes } from '@test/helpers/route-test-setup';
import { createProjectData } from '@test/factories/project.factory';
import {
  projects as projectsSchema,
  projectExclusions as exclusionsSchema,
} from '@shared/database/schema';

// Mock the database connection module
mockDatabaseForIntegration();

describe('Projects Exclusions API Integration Tests', () => {
  const context = createIntegrationTestContext();

  beforeEach(async () => {
    await setupProjectRoutes(context);
  });

  afterEach(async () => {
    await context.teardown();
  });

  describe('GET /api/projects/:id/exclusions', () => {
    it('should return empty array when no exclusions exist', async () => {
      const { db, app } = context.get();

      // Create a project
      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      const response = await get(app, `/api/projects/${project.id}/exclusions`);

      expect(response.status).toBe(200);
      expect((response.data as any).data).toEqual([]);
    });

    it('should return all exclusions for a project', async () => {
      const { db, app } = context.get();

      // Create a project
      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      // Create exclusions
      await db.insert(exclusionsSchema).values([
        {
          projectId: project.id,
          path: 'node_modules',
        },
        {
          projectId: project.id,
          path: 'dist',
        },
      ]);

      const response = await get(app, `/api/projects/${project.id}/exclusions`);

      expect(response.status).toBe(200);
      const exclusions = (response.data as any).data;
      expect(exclusions).toHaveLength(2);
      expect(exclusions.map((e: any) => e.path)).toContain('node_modules');
      expect(exclusions.map((e: any) => e.path)).toContain('dist');
    });

    it('should return 404 for non-existent project', async () => {
      const { app } = context.get();

      const response = await get(app, '/api/projects/non-existent-id/exclusions');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/projects/:id/exclusions', () => {
    it('should add an exclusion to a project', async () => {
      const { db, app } = context.get();

      // Create a project
      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      const response = await post(app, `/api/projects/${project.id}/exclusions`, {
        path: 'vendor',
      });

      expect(response.status).toBe(200);
      expect((response.data as any).data).toBeDefined();
      expect((response.data as any).data.path).toBe('vendor');
      expect((response.data as any).data.projectId).toBe(project.id);
    });

    it('should normalize path by removing leading/trailing slashes', async () => {
      const { db, app } = context.get();

      // Create a project
      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      const response = await post(app, `/api/projects/${project.id}/exclusions`, {
        path: '/dist/',
      });

      expect(response.status).toBe(200);
      expect((response.data as any).data.path).toBe('dist');
    });

    it('should return 400 when path is missing', async () => {
      const { db, app } = context.get();

      // Create a project
      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      const response = await post(app, `/api/projects/${project.id}/exclusions`, {});

      expect(response.status).toBe(400);
      expect((response.data as any).error).toBe('path is required');
    });

    it('should return 400 when path is empty string', async () => {
      const { db, app } = context.get();

      // Create a project
      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      const response = await post(app, `/api/projects/${project.id}/exclusions`, {
        path: '',
      });

      expect(response.status).toBe(400);
      expect((response.data as any).error).toBe('path is required');
    });

    it('should return 400 for duplicate exclusion', async () => {
      const { db, app } = context.get();

      // Create a project
      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      // Add first exclusion
      await post(app, `/api/projects/${project.id}/exclusions`, {
        path: 'node_modules',
      });

      // Try to add duplicate
      const response = await post(app, `/api/projects/${project.id}/exclusions`, {
        path: 'node_modules',
      });

      expect(response.status).toBe(400);
      expect((response.data as any).error).toBe('This path is already excluded');
    });

    it('should detect duplicates after normalization', async () => {
      const { db, app } = context.get();

      // Create a project
      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      // Add exclusion with normalized path
      await post(app, `/api/projects/${project.id}/exclusions`, {
        path: 'dist',
      });

      // Try to add with slashes
      const response = await post(app, `/api/projects/${project.id}/exclusions`, {
        path: '/dist/',
      });

      expect(response.status).toBe(400);
      expect((response.data as any).error).toBe('This path is already excluded');
    });

    it('should return 404 for non-existent project', async () => {
      const { app } = context.get();

      const response = await post(app, '/api/projects/non-existent-id/exclusions', {
        path: 'node_modules',
      });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/projects/:id/exclusions/:exclusionId', () => {
    it('should remove an exclusion from a project', async () => {
      const { db, app } = context.get();

      // Create a project
      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      // Create an exclusion
      const [exclusion] = await db
        .insert(exclusionsSchema)
        .values({
          projectId: project.id,
          path: 'node_modules',
        })
        .returning();

      const response = await del(app, `/api/projects/${project.id}/exclusions/${exclusion.id}`);

      expect(response.status).toBe(200);
      expect((response.data as any).success).toBe(true);

      // Verify exclusion was deleted
      const exclusions = await db
        .select()
        .from(exclusionsSchema)
        .where(t => eq(t.id, exclusion.id));
      expect(exclusions).toHaveLength(0);
    });

    it('should return success true even for non-existent exclusion', async () => {
      const { db, app } = context.get();

      // Create a project
      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      const response = await del(app, `/api/projects/${project.id}/exclusions/non-existent-id`);

      expect(response.status).toBe(200);
      expect((response.data as any).success).toBe(true);
    });

    it('should only remove specified exclusion, not others', async () => {
      const { db, app } = context.get();

      // Create a project
      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      // Create multiple exclusions
      const [excl1] = await db
        .insert(exclusionsSchema)
        .values({ projectId: project.id, path: 'dist' })
        .returning();
      await db.insert(exclusionsSchema).values({ projectId: project.id, path: 'build' });
      await db.insert(exclusionsSchema).values({ projectId: project.id, path: 'vendor' });

      // Delete first one
      await del(app, `/api/projects/${project.id}/exclusions/${excl1.id}`);

      // Verify others remain
      const response = await get(app, `/api/projects/${project.id}/exclusions`);
      const remaining = (response.data as any).data;

      expect(remaining).toHaveLength(2);
      expect(remaining.map((e: any) => e.path)).not.toContain('dist');
      expect(remaining.map((e: any) => e.path)).toContain('build');
      expect(remaining.map((e: any) => e.path)).toContain('vendor');
    });
  });
});
