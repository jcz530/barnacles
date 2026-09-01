import os from 'os';
import nodePath from 'path';
import fs from 'fs/promises';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createIntegrationTestContext, mockDatabaseForIntegration } from '@test/contexts';
import { get, post } from '@test/helpers/api-client';
import { setupProjectRoutes } from '@test/helpers/route-test-setup';
import { createProjectData } from '@test/factories/project.factory';
import { projects as projectsSchema } from '@shared/database/schema';

// Mock the database connection module
mockDatabaseForIntegration();

/**
 * POST touches the real filesystem (marker-file check, then a scan), so these
 * need actual directories rather than the invented paths the GET tests use.
 */
async function makeProjectDir(marker = 'package.json'): Promise<string> {
  const dir = await fs.mkdtemp(nodePath.join(os.tmpdir(), 'barnacles-project-'));
  await fs.writeFile(nodePath.join(dir, marker), '{"name":"temp-project"}');
  return dir;
}

/**
 * The route stores canonical paths, and on macOS the temp dir is a symlink
 * (/var -> /private/var), so expectations have to resolve too.
 */
function real(dir: string): Promise<string> {
  return fs.realpath(dir);
}

describe('Projects By-Path API Integration Tests', () => {
  const context = createIntegrationTestContext();
  const tempDirs: string[] = [];

  beforeEach(async () => {
    await setupProjectRoutes(context);
  });

  afterEach(async () => {
    await context.teardown();
    await Promise.all(tempDirs.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true })));
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

  describe('POST /api/projects/meta/by-path', () => {
    it('should require a path', async () => {
      const { app } = context.get();
      const response = await post(app, '/api/projects/meta/by-path', {});

      expect(response.status).toBe(400);
    });

    it('should add a project that is not tracked yet', async () => {
      const { app } = context.get();
      const dir = await makeProjectDir();
      tempDirs.push(dir);

      const response = await post(app, '/api/projects/meta/by-path', { path: dir });

      expect(response.status).toBe(200);
      const body = response.data as any;
      expect(body.meta.created).toBe(true);
      expect(body.data.path).toBe(await real(dir));
    });

    it('should add a project outside the configured scan directories', async () => {
      const { app } = context.get();
      // The temp dir is deliberately nowhere near ~/Development et al.
      const dir = await makeProjectDir();
      tempDirs.push(dir);

      const response = await post(app, '/api/projects/meta/by-path', { path: dir });

      expect(response.status).toBe(200);
      const body = response.data as any;
      expect(body.meta.withinScanDirectories).toBe(false);
      // The parent is what the user would add to have future scans find it.
      expect(body.meta.suggestedScanDirectory).toBe(nodePath.dirname(await real(dir)));
    });

    it('should refresh rather than duplicate an already-tracked project', async () => {
      const { app } = context.get();
      const dir = await makeProjectDir();
      tempDirs.push(dir);

      const first = await post(app, '/api/projects/meta/by-path', { path: dir });
      const second = await post(app, '/api/projects/meta/by-path', { path: dir });

      expect((first.data as any).meta.created).toBe(true);
      expect((second.data as any).meta.created).toBe(false);
      expect((second.data as any).data.id).toBe((first.data as any).data.id);
    });

    it('should accept a git repository with no other marker file', async () => {
      const { app } = context.get();
      const dir = await fs.mkdtemp(nodePath.join(os.tmpdir(), 'barnacles-git-'));
      tempDirs.push(dir);
      await fs.mkdir(nodePath.join(dir, '.git'));

      const response = await post(app, '/api/projects/meta/by-path', { path: dir });

      expect(response.status).toBe(200);
    });

    it('should not duplicate a project when the path has a trailing slash', async () => {
      const { app } = context.get();
      const dir = await makeProjectDir();
      tempDirs.push(dir);

      const first = await post(app, '/api/projects/meta/by-path', { path: dir });
      const second = await post(app, '/api/projects/meta/by-path', { path: `${dir}/` });

      expect((second.data as any).meta.created).toBe(false);
      expect((second.data as any).data.id).toBe((first.data as any).data.id);
    });

    it('should treat a subdirectory of a tracked project as its own project', async () => {
      const { app } = context.get();
      const outer = await makeProjectDir();
      tempDirs.push(outer);
      const inner = nodePath.join(outer, 'packages', 'inner');
      await fs.mkdir(inner, { recursive: true });
      await fs.writeFile(nodePath.join(inner, 'package.json'), '{"name":"inner"}');

      const first = await post(app, '/api/projects/meta/by-path', { path: outer });
      const second = await post(app, '/api/projects/meta/by-path', { path: inner });

      // getProjectByPath would have matched the parent and reported created:false
      // while still inserting a second row.
      expect((second.data as any).meta.created).toBe(true);
      expect((second.data as any).data.id).not.toBe((first.data as any).data.id);
    });

    it('should reject a relative path', async () => {
      const { app } = context.get();

      const response = await post(app, '/api/projects/meta/by-path', { path: './somewhere' });

      expect(response.status).toBe(400);
      expect((response.data as any).error).toMatch(/absolute/i);
    });

    it('should reject a directory with no project markers', async () => {
      const { app } = context.get();
      const dir = await fs.mkdtemp(nodePath.join(os.tmpdir(), 'barnacles-empty-'));
      tempDirs.push(dir);

      const response = await post(app, '/api/projects/meta/by-path', { path: dir });

      expect(response.status).toBe(422);
      expect((response.data as any).error).toMatch(/does not look like a project/i);
    });

    it('should reject a path that does not exist', async () => {
      const { app } = context.get();

      const response = await post(app, '/api/projects/meta/by-path', {
        path: nodePath.join(os.tmpdir(), 'barnacles-missing-xyz'),
      });

      expect(response.status).toBe(422);
    });
  });
});
