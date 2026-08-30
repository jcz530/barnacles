import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createIntegrationTestContext, mockDatabaseForIntegration } from '@test/contexts';
import { get, patch, post } from '@test/helpers/api-client';
import { setupProjectRoutes } from '@test/helpers/route-test-setup';
import { createProjectData } from '@test/factories/project.factory';
import {
  projects as projectsSchema,
  projectWorktrees as worktreesSchema,
} from '@shared/database/schema';

// Mock the database connection module
mockDatabaseForIntegration();

describe('Projects Worktrees API Integration Tests', () => {
  const context = createIntegrationTestContext();

  beforeEach(async () => {
    await setupProjectRoutes(context);
  });

  afterEach(async () => {
    await context.teardown();
  });

  describe('GET /api/projects/:id/worktrees', () => {
    it('should return empty array when no worktrees exist', async () => {
      const { db, app } = context.get();
      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      const response = await get(app, `/api/projects/${project.id}/worktrees`);

      expect(response.status).toBe(200);
      expect((response.data as any).data).toEqual([]);
    });

    it('should return worktrees with the main checkout first', async () => {
      const { db, app } = context.get();
      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      // Insert the linked worktree first, so ordering cannot pass by accident
      await db.insert(worktreesSchema).values([
        {
          projectId: project.id,
          path: '/tmp/linked-worktree',
          branch: 'feature/x',
          isMain: false,
        },
        {
          projectId: project.id,
          path: '/tmp/main-worktree',
          branch: 'main',
          isMain: true,
        },
      ]);

      const response = await get(app, `/api/projects/${project.id}/worktrees`);
      const data = (response.data as any).data;

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(data[0]).toMatchObject({ path: '/tmp/main-worktree', isMain: true });
      expect(data[1]).toMatchObject({ path: '/tmp/linked-worktree', branch: 'feature/x' });
    });

    it('should return 404 for a non-existent project', async () => {
      const { app } = context.get();

      const response = await get(app, '/api/projects/does-not-exist/worktrees');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/projects/:id/worktrees/sync', () => {
    it('should return 404 for a non-existent project', async () => {
      const { app } = context.get();

      const response = await post(app, '/api/projects/does-not-exist/worktrees/sync', {});

      expect(response.status).toBe(404);
    });

    it('should leave worktrees untouched when the path is not a git repo', async () => {
      const { db, app } = context.get();
      const [project] = await db
        .insert(projectsSchema)
        .values(createProjectData({ path: '/tmp/definitely-not-a-git-repo' }))
        .returning();
      await db.insert(worktreesSchema).values({
        projectId: project.id,
        path: '/tmp/known-worktree',
        branch: 'main',
        isMain: true,
      });

      const response = await post(app, `/api/projects/${project.id}/worktrees/sync`, {});

      // A failed git call must not delete what we already know
      expect(response.status).toBe(200);
      expect((response.data as any).data).toHaveLength(1);
    });
  });

  describe('PATCH /api/projects/:id/worktrees/:worktreeId', () => {
    it('should update the preferred IDE', async () => {
      const { db, app } = context.get();
      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();
      const [worktree] = await db
        .insert(worktreesSchema)
        .values({
          projectId: project.id,
          path: '/tmp/main-worktree',
          branch: 'main',
          isMain: true,
        })
        .returning();

      const response = await patch(app, `/api/projects/${project.id}/worktrees/${worktree.id}`, {
        preferredIde: 'intellij',
      });

      expect(response.status).toBe(200);
      const [updated] = await db
        .select()
        .from(worktreesSchema)
        .where(eq(worktreesSchema.id, worktree.id));
      expect(updated.preferredIde).toBe('intellij');
    });

    it('should return 400 when preferredIde is missing', async () => {
      const { db, app } = context.get();
      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();
      const [worktree] = await db
        .insert(worktreesSchema)
        .values({ projectId: project.id, path: '/tmp/main-worktree', isMain: true })
        .returning();

      const response = await patch(app, `/api/projects/${project.id}/worktrees/${worktree.id}`, {});

      expect(response.status).toBe(400);
    });

    it('should return 400 for a non-existent worktree', async () => {
      const { db, app } = context.get();
      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      const response = await patch(app, `/api/projects/${project.id}/worktrees/nope`, {
        preferredIde: 'vscode',
      });

      expect(response.status).toBe(400);
    });
  });
});
