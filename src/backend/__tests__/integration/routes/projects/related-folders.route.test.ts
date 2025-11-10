import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createIntegrationTestContext, mockDatabaseForIntegration } from '@test/contexts';
import { del, get, post } from '@test/helpers/api-client';
import { setupProjectRoutes } from '@test/helpers/route-test-setup';
import { createProjectData } from '@test/factories/project.factory';
import {
  projects as projectsSchema,
  projectRelatedFolders as relatedFoldersSchema,
} from '@shared/database/schema';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

// Mock the database connection module
mockDatabaseForIntegration();

describe('Projects Related Folders API Integration Tests', () => {
  const context = createIntegrationTestContext();

  beforeEach(async () => {
    await setupProjectRoutes(context);
  });

  afterEach(async () => {
    await context.teardown();
  });

  describe('GET /api/projects/:id/related-folders', () => {
    it('should return empty array when no related folders exist', async () => {
      const { db, app } = context.get();

      // Create a project
      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      const response = await get(app, `/api/projects/${project.id}/related-folders`);

      expect(response.status).toBe(200);
      expect((response.data as any).data).toEqual([]);
    });

    it('should return all related folders for a project', async () => {
      const { db, app } = context.get();

      // Create a project
      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      // Create related folders
      await db.insert(relatedFoldersSchema).values([
        {
          projectId: project.id,
          folderPath: '/path/to/folder1',
        },
        {
          projectId: project.id,
          folderPath: '/path/to/folder2',
        },
      ]);

      const response = await get(app, `/api/projects/${project.id}/related-folders`);

      expect(response.status).toBe(200);
      const folders = (response.data as any).data;
      expect(folders).toHaveLength(2);
    });

    it('should return 404 for non-existent project', async () => {
      const { app } = context.get();

      const response = await get(app, '/api/projects/non-existent-id/related-folders');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/projects/:id/related-folders', () => {
    it('should add a related folder to a project', async () => {
      const { db, app } = context.get();

      // Create a temporary folder
      const tempFolder = join(tmpdir(), `test-related-folder-${Date.now()}`);
      await mkdir(tempFolder, { recursive: true });

      // Create a project
      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      const response = await post(app, `/api/projects/${project.id}/related-folders`, {
        folderPath: tempFolder,
      });

      expect(response.status).toBe(200);
      expect((response.data as any).data).toBeDefined();
      expect((response.data as any).data.folderPath).toBe(tempFolder);
    });

    it('should return 400 when folderPath is missing', async () => {
      const { db, app } = context.get();

      // Create a project
      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      const response = await post(app, `/api/projects/${project.id}/related-folders`, {});

      expect(response.status).toBe(400);
      expect((response.data as any).error).toBe('folderPath is required');
    });

    it('should return 400 when folder does not exist', async () => {
      const { db, app } = context.get();

      // Create a project
      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      const response = await post(app, `/api/projects/${project.id}/related-folders`, {
        folderPath: '/nonexistent/folder/path',
      });

      expect(response.status).toBe(400);
    });

    it('should return 404 for non-existent project', async () => {
      const { app } = context.get();

      const response = await post(app, '/api/projects/non-existent-id/related-folders', {
        folderPath: '/some/path',
      });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/projects/:id/related-folders/:folderId', () => {
    it('should remove a related folder from a project', async () => {
      const { db, app } = context.get();

      // Create a project
      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      // Create a related folder
      const [folder] = await db
        .insert(relatedFoldersSchema)
        .values({
          projectId: project.id,
          folderPath: '/path/to/folder',
        })
        .returning();

      const response = await del(app, `/api/projects/${project.id}/related-folders/${folder.id}`);

      expect(response.status).toBe(200);
      expect((response.data as any).success).toBe(true);

      // Verify folder was deleted
      const folders = await db
        .select()
        .from(relatedFoldersSchema)
        .where(t => eq(t.id, folder.id));
      expect(folders).toHaveLength(0);
    });

    it('should return success true even for non-existent folder', async () => {
      const { db, app } = context.get();

      // Create a project
      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      const response = await del(
        app,
        `/api/projects/${project.id}/related-folders/non-existent-id`
      );

      expect(response.status).toBe(200);
      expect((response.data as any).success).toBe(true);
    });
  });
});
