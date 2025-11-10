import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createIntegrationTestContext, mockDatabaseForIntegration } from '@test/contexts';
import { get } from '@test/helpers/api-client';
import { setupProjectRoutes } from '@test/helpers/route-test-setup';
import { createProjectData } from '@test/factories/project.factory';
import { projects as projectsSchema } from '@shared/database/schema';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock the database connection module
mockDatabaseForIntegration();

describe('Projects Files API Integration Tests', () => {
  const context = createIntegrationTestContext();

  beforeEach(async () => {
    await setupProjectRoutes(context);
  });

  afterEach(async () => {
    await context.teardown();
  });

  describe('GET /api/projects/:id/readme', () => {
    it('should return README content when it exists', async () => {
      const { db, app } = context.get();

      // Create a temporary project directory with a README
      const tempDir = join(tmpdir(), `test-project-${Date.now()}`);
      await mkdir(tempDir, { recursive: true });
      const readmeContent = '# Test Project\n\nThis is a test readme.';
      await writeFile(join(tempDir, 'README.md'), readmeContent);

      // Create a project with the temp directory
      const [project] = await db
        .insert(projectsSchema)
        .values(createProjectData({ path: tempDir }))
        .returning();

      const response = await get(app, `/api/projects/${project.id}/readme`);

      expect(response.status).toBe(200);
      expect((response.data as any).data).toBeDefined();
    });

    it('should return 404 when README does not exist', async () => {
      const { db, app } = context.get();

      // Create a project without a README
      const tempDir = join(tmpdir(), `test-project-no-readme-${Date.now()}`);
      await mkdir(tempDir, { recursive: true });

      const [project] = await db
        .insert(projectsSchema)
        .values(createProjectData({ path: tempDir }))
        .returning();

      const response = await get(app, `/api/projects/${project.id}/readme`);

      expect(response.status).toBe(404);
      expect((response.data as any).error).toBe('README.md not found');
    });

    it('should return 404 for non-existent project', async () => {
      const { app } = context.get();

      const response = await get(app, '/api/projects/non-existent-id/readme');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/projects/:id/file', () => {
    it('should serve a file from the project directory', async () => {
      const { db, app } = context.get();

      // Create a temporary project directory with a file
      const tempDir = join(tmpdir(), `test-project-file-${Date.now()}`);
      await mkdir(tempDir, { recursive: true });
      const fileContent = 'Test file content';
      await writeFile(join(tempDir, 'test.txt'), fileContent);

      // Create a project with the temp directory
      const [project] = await db
        .insert(projectsSchema)
        .values(createProjectData({ path: tempDir }))
        .returning();

      const response = await get(app, `/api/projects/${project.id}/file?path=test.txt`);

      expect(response.status).toBe(200);
    });

    it('should return 400 when path parameter is missing', async () => {
      const { db, app } = context.get();

      // Create a project
      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      const response = await get(app, `/api/projects/${project.id}/file`);

      expect(response.status).toBe(400);
      expect((response.data as any).error).toBe('File path is required');
    });

    it('should return 403 for path traversal attempts', async () => {
      const { db, app } = context.get();

      // Create a project
      const tempDir = join(tmpdir(), `test-project-security-${Date.now()}`);
      await mkdir(tempDir, { recursive: true });

      const [project] = await db
        .insert(projectsSchema)
        .values(createProjectData({ path: tempDir }))
        .returning();

      const response = await get(app, `/api/projects/${project.id}/file?path=../../etc/passwd`);

      expect(response.status).toBe(403);
      expect((response.data as any).error).toBe('Access denied');
    });

    it('should return 404 when file does not exist', async () => {
      const { db, app } = context.get();

      // Create a project
      const tempDir = join(tmpdir(), `test-project-nofile-${Date.now()}`);
      await mkdir(tempDir, { recursive: true });

      const [project] = await db
        .insert(projectsSchema)
        .values(createProjectData({ path: tempDir }))
        .returning();

      const response = await get(app, `/api/projects/${project.id}/file?path=nonexistent.txt`);

      expect(response.status).toBe(404);
      expect((response.data as any).error).toBe('File not found');
    });

    it('should return 404 for non-existent project', async () => {
      const { app } = context.get();

      const response = await get(app, '/api/projects/non-existent-id/file?path=test.txt');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/projects/:id/icon', () => {
    it('should serve the project icon when it exists', async () => {
      const { db, app } = context.get();

      // Create a temporary project directory with an icon
      const tempDir = join(tmpdir(), `test-project-icon-${Date.now()}`);
      await mkdir(tempDir, { recursive: true });
      const iconContent = Buffer.from('fake-png-data');
      await writeFile(join(tempDir, 'icon.png'), iconContent);

      // Create a project with the icon
      const [project] = await db
        .insert(projectsSchema)
        .values(createProjectData({ path: tempDir, icon: 'icon.png' }))
        .returning();

      const response = await get(app, `/api/projects/${project.id}/icon`);

      expect(response.status).toBe(200);
    });

    it('should return 404 when project has no icon', async () => {
      const { db, app } = context.get();

      // Create a project without an icon
      const [project] = await db
        .insert(projectsSchema)
        .values(createProjectData({ icon: null }))
        .returning();

      const response = await get(app, `/api/projects/${project.id}/icon`);

      expect(response.status).toBe(404);
      expect((response.data as any).error).toBe('No icon found for this project');
    });

    it('should return 404 when icon file does not exist', async () => {
      const { db, app } = context.get();

      // Create a project with an icon path that doesn't exist
      const tempDir = join(tmpdir(), `test-project-noicon-${Date.now()}`);
      await mkdir(tempDir, { recursive: true });

      const [project] = await db
        .insert(projectsSchema)
        .values(createProjectData({ path: tempDir, icon: 'nonexistent.png' }))
        .returning();

      const response = await get(app, `/api/projects/${project.id}/icon`);

      expect(response.status).toBe(404);
      expect((response.data as any).error).toBe('Icon file not found');
    });

    it('should return 404 for non-existent project', async () => {
      const { app } = context.get();

      const response = await get(app, '/api/projects/non-existent-id/icon');

      expect(response.status).toBe(404);
    });
  });
});
