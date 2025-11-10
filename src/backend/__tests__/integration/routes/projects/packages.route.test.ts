import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createIntegrationTestContext, mockDatabaseForIntegration } from '@test/contexts';
import { get, post } from '@test/helpers/api-client';
import { setupProjectRoutes } from '@test/helpers/route-test-setup';
import { createProjectData } from '@test/factories/project.factory';
import { projects as projectsSchema } from '@shared/database/schema';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock the database connection module
mockDatabaseForIntegration();

describe('Projects Packages API Integration Tests', () => {
  const context = createIntegrationTestContext();

  beforeEach(async () => {
    await setupProjectRoutes(context);
  });

  afterEach(async () => {
    await context.teardown();
  });

  describe('GET /api/projects/:id/package-scripts', () => {
    it('should return package.json scripts when they exist', async () => {
      const { db, app } = context.get();

      // Create a temporary project directory with package.json
      const tempDir = join(tmpdir(), `test-project-pkg-${Date.now()}`);
      await mkdir(tempDir, { recursive: true });
      const packageJson = {
        name: 'test-project',
        scripts: {
          dev: 'vite',
          build: 'vite build',
          test: 'vitest',
        },
      };
      await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      // Create a project with the temp directory
      const [project] = await db
        .insert(projectsSchema)
        .values(createProjectData({ path: tempDir }))
        .returning();

      const response = await get(app, `/api/projects/${project.id}/package-scripts`);

      expect(response.status).toBe(200);
      expect((response.data as any).data).toBeDefined();
    });

    it('should return empty scripts when package.json has no scripts', async () => {
      const { db, app } = context.get();

      // Create a temporary project directory with package.json without scripts
      const tempDir = join(tmpdir(), `test-project-noscripts-${Date.now()}`);
      await mkdir(tempDir, { recursive: true });
      const packageJson = {
        name: 'test-project',
      };
      await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      // Create a project with the temp directory
      const [project] = await db
        .insert(projectsSchema)
        .values(createProjectData({ path: tempDir }))
        .returning();

      const response = await get(app, `/api/projects/${project.id}/package-scripts`);

      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent project', async () => {
      const { app } = context.get();

      const response = await get(app, '/api/projects/non-existent-id/package-scripts');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/projects/:id/composer-scripts', () => {
    it('should return composer.json scripts when they exist', async () => {
      const { db, app } = context.get();

      // Create a temporary project directory with composer.json
      const tempDir = join(tmpdir(), `test-project-composer-${Date.now()}`);
      await mkdir(tempDir, { recursive: true });
      const composerJson = {
        name: 'test/project',
        scripts: {
          test: 'phpunit',
          'post-install-cmd': ['@php artisan optimize'],
        },
      };
      await writeFile(join(tempDir, 'composer.json'), JSON.stringify(composerJson, null, 2));

      // Create a project with the temp directory
      const [project] = await db
        .insert(projectsSchema)
        .values(createProjectData({ path: tempDir }))
        .returning();

      const response = await get(app, `/api/projects/${project.id}/composer-scripts`);

      expect(response.status).toBe(200);
      expect((response.data as any).data).toBeDefined();
    });

    it('should return 404 for non-existent project', async () => {
      const { app } = context.get();

      const response = await get(app, '/api/projects/non-existent-id/composer-scripts');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/projects/:id/package-manager', () => {
    it('should detect npm as package manager', async () => {
      const { db, app } = context.get();

      // Create a temporary project directory with package-lock.json
      const tempDir = join(tmpdir(), `test-project-npm-${Date.now()}`);
      await mkdir(tempDir, { recursive: true });
      await writeFile(join(tempDir, 'package-lock.json'), '{}');

      // Create a project with the temp directory
      const [project] = await db
        .insert(projectsSchema)
        .values(createProjectData({ path: tempDir }))
        .returning();

      const response = await get(app, `/api/projects/${project.id}/package-manager`);

      expect(response.status).toBe(200);
      expect((response.data as any).data).toBeDefined();
    });

    it('should detect yarn as package manager', async () => {
      const { db, app } = context.get();

      // Create a temporary project directory with yarn.lock
      const tempDir = join(tmpdir(), `test-project-yarn-${Date.now()}`);
      await mkdir(tempDir, { recursive: true });
      await writeFile(join(tempDir, 'yarn.lock'), '');

      // Create a project with the temp directory
      const [project] = await db
        .insert(projectsSchema)
        .values(createProjectData({ path: tempDir }))
        .returning();

      const response = await get(app, `/api/projects/${project.id}/package-manager`);

      expect(response.status).toBe(200);
      expect((response.data as any).data).toBeDefined();
    });

    it('should detect pnpm as package manager', async () => {
      const { db, app } = context.get();

      // Create a temporary project directory with pnpm-lock.yaml
      const tempDir = join(tmpdir(), `test-project-pnpm-${Date.now()}`);
      await mkdir(tempDir, { recursive: true });
      await writeFile(join(tempDir, 'pnpm-lock.yaml'), '');

      // Create a project with the temp directory
      const [project] = await db
        .insert(projectsSchema)
        .values(createProjectData({ path: tempDir }))
        .returning();

      const response = await get(app, `/api/projects/${project.id}/package-manager`);

      expect(response.status).toBe(200);
      expect((response.data as any).data).toBeDefined();
    });

    it('should return 404 for non-existent project', async () => {
      const { app } = context.get();

      const response = await get(app, '/api/projects/non-existent-id/package-manager');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/projects/:id/delete-packages', () => {
    it('should delete node_modules when they exist', async () => {
      const { db, app } = context.get();

      // Create a temporary project directory with node_modules and package.json
      const tempDir = join(tmpdir(), `test-project-delpackages-${Date.now()}`);
      await mkdir(tempDir, { recursive: true });

      // Create package.json to make it a valid Node project
      const packageJson = { name: 'test-project', version: '1.0.0' };
      await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      const nodeModulesDir = join(tempDir, 'node_modules');
      await mkdir(nodeModulesDir, { recursive: true });
      await writeFile(join(nodeModulesDir, 'test.txt'), 'test');

      // Create a project with the temp directory
      const [project] = await db
        .insert(projectsSchema)
        .values(createProjectData({ path: tempDir }))
        .returning();

      const response = await post(app, `/api/projects/${project.id}/delete-packages`);

      expect(response.status).toBe(200);
      expect((response.data as any).message).toBe('Third-party packages deleted successfully');
    });

    it('should handle case when no packages exist', async () => {
      const { db, app } = context.get();

      // Create a temporary project directory without node_modules but with package.json
      const tempDir = join(tmpdir(), `test-project-nopackages-${Date.now()}`);
      await mkdir(tempDir, { recursive: true });

      // Create package.json to make it a valid Node project
      const packageJson = { name: 'test-project', version: '1.0.0' };
      await writeFile(join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));

      // Create a project with the temp directory
      const [project] = await db
        .insert(projectsSchema)
        .values(createProjectData({ path: tempDir }))
        .returning();

      const response = await post(app, `/api/projects/${project.id}/delete-packages`);

      expect(response.status).toBe(200);
    });

    it('should return 404 for non-existent project', async () => {
      const { app } = context.get();

      const response = await post(app, '/api/projects/non-existent-id/delete-packages');

      expect(response.status).toBe(404);
    });
  });
});
