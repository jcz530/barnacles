import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createIntegrationTestContext, mockDatabaseForIntegration } from '@test/contexts';
import { get } from '@test/helpers/api-client';
import { setupProjectRoutes } from '@test/helpers/route-test-setup';
import { createProjectData } from '@test/factories/project.factory';
import { projects as projectsSchema } from '@shared/database/schema';

// Mock the database connection module
mockDatabaseForIntegration();

describe('Projects By-Path API Integration Tests', () => {
  const context = createIntegrationTestContext();

  beforeEach(async () => {
    await setupProjectRoutes(context);
  });

  afterEach(async () => {
    await context.teardown();
  });

  describe('GET /api/projects/meta/by-path', () => {
    it('should require the path query parameter', async () => {
      const { app } = context.get();
      const response = await get(app, '/api/projects/meta/by-path');

      expect(response.status).toBe(400);
    });

    it('should return 404 when no project contains the given path', async () => {
      const { app } = context.get();
      const response = await get(
        app,
        '/api/projects/meta/by-path?path=' + encodeURIComponent('/nowhere/at/all')
      );

      expect(response.status).toBe(404);
    });

    it('should resolve a project by its exact root path', async () => {
      const { db, app } = context.get();
      await db
        .insert(projectsSchema)
        .values(createProjectData({ name: 'my-app', path: '/projects/my-app', archivedAt: null }));

      const response = await get(
        app,
        '/api/projects/meta/by-path?path=' + encodeURIComponent('/projects/my-app')
      );

      expect(response.status).toBe(200);
      expect((response.data as any).data.name).toBe('my-app');
    });

    it('should resolve a project when given a subdirectory of its root path', async () => {
      const { db, app } = context.get();
      await db
        .insert(projectsSchema)
        .values(createProjectData({ name: 'my-app', path: '/projects/my-app', archivedAt: null }));

      const response = await get(
        app,
        '/api/projects/meta/by-path?path=' + encodeURIComponent('/projects/my-app/src/backend')
      );

      expect(response.status).toBe(200);
      expect((response.data as any).data.name).toBe('my-app');
    });

    it('should not match a sibling project with a similar path prefix', async () => {
      const { db, app } = context.get();
      await db.insert(projectsSchema).values([
        createProjectData({ name: 'my-app', path: '/projects/my-app', archivedAt: null }),
        createProjectData({
          name: 'my-app-extra',
          path: '/projects/my-app-extra',
          archivedAt: null,
        }),
      ]);

      const response = await get(
        app,
        '/api/projects/meta/by-path?path=' + encodeURIComponent('/projects/my-app-extra/src')
      );

      expect(response.status).toBe(200);
      expect((response.data as any).data.name).toBe('my-app-extra');
    });

    it('should pick the most specific match for nested projects', async () => {
      const { db, app } = context.get();
      await db
        .insert(projectsSchema)
        .values([
          createProjectData({ name: 'outer', path: '/projects/outer', archivedAt: null }),
          createProjectData({ name: 'inner', path: '/projects/outer/inner', archivedAt: null }),
        ]);

      const response = await get(
        app,
        '/api/projects/meta/by-path?path=' + encodeURIComponent('/projects/outer/inner/src')
      );

      expect(response.status).toBe(200);
      expect((response.data as any).data.name).toBe('inner');
    });

    it('should not resolve archived projects', async () => {
      const { db, app } = context.get();
      await db.insert(projectsSchema).values(
        createProjectData({
          name: 'archived-app',
          path: '/projects/archived-app',
          archivedAt: new Date(),
        })
      );

      const response = await get(
        app,
        '/api/projects/meta/by-path?path=' + encodeURIComponent('/projects/archived-app')
      );

      expect(response.status).toBe(404);
    });
  });
});
