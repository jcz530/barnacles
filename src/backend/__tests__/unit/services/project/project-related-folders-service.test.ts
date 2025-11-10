import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUnitTestContext, mockDatabaseForUnit } from '@test/contexts';
import { projectRelatedFoldersService } from '@backend/services/project/project-related-folders-service';
import { db } from '@shared/database';
import { projectRelatedFolders, projects } from '@shared/database/schema';
import * as fs from 'fs/promises';
import * as os from 'os';

// Mock the database connection module
mockDatabaseForUnit();

// Mock file system
vi.mock('fs/promises');

describe('ProjectRelatedFoldersService', () => {
  const context = createUnitTestContext();

  beforeEach(async () => {
    await context.setup();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await context.teardown();
  });

  describe('getRelatedFolders', () => {
    it('should return related folders for a project', async () => {
      const projectId = 'test-project-123';

      // Create project first
      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      // Insert some related folders
      await db.insert(projectRelatedFolders).values([
        {
          projectId,
          folderPath: '/path/to/folder1',
          createdAt: new Date('2024-01-01'),
        },
        {
          projectId,
          folderPath: '/path/to/folder2',
          createdAt: new Date('2024-01-02'),
        },
      ]);

      const result = await projectRelatedFoldersService.getRelatedFolders(projectId);

      expect(result).toHaveLength(2);
      expect(result[0].folderPath).toBe('/path/to/folder1');
      expect(result[1].folderPath).toBe('/path/to/folder2');
    });

    it('should return empty array for project with no related folders', async () => {
      const result = await projectRelatedFoldersService.getRelatedFolders('nonexistent-project');
      expect(result).toHaveLength(0);
    });

    it('should return folders ordered by creation date', async () => {
      const projectId = 'test-order-project';

      // Create project first
      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      // Insert folders in non-chronological order
      await db.insert(projectRelatedFolders).values([
        {
          projectId,
          folderPath: '/path/third',
          createdAt: new Date('2024-03-01'),
        },
        {
          projectId,
          folderPath: '/path/first',
          createdAt: new Date('2024-01-01'),
        },
        {
          projectId,
          folderPath: '/path/second',
          createdAt: new Date('2024-02-01'),
        },
      ]);

      const result = await projectRelatedFoldersService.getRelatedFolders(projectId);

      expect(result).toHaveLength(3);
      expect(result[0].folderPath).toBe('/path/first');
      expect(result[1].folderPath).toBe('/path/second');
      expect(result[2].folderPath).toBe('/path/third');
    });
  });

  describe('addRelatedFolder', () => {
    it('should add a valid folder to a project', async () => {
      const projectId = 'test-project-456';
      const folderPath = '/valid/folder/path';

      // Create project first
      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      // Mock folder exists and is a directory
      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
      } as any);

      const result = await projectRelatedFoldersService.addRelatedFolder(projectId, folderPath);

      expect(result.success).toBe(true);
      expect(result.folder).toBeDefined();
      expect(result.folder?.folderPath).toBe(folderPath);
      expect(result.folder?.projectId).toBe(projectId);

      // Verify it was added to database
      const saved = await projectRelatedFoldersService.getRelatedFolders(projectId);
      expect(saved).toHaveLength(1);
      expect(saved[0].folderPath).toBe(folderPath);
    });

    it('should expand tilde in folder path', async () => {
      const projectId = 'test-tilde-project';
      const folderPath = '~/Documents/projects';

      // Create project first
      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      const homeDir = os.homedir();
      const expandedPath = `${homeDir}/Documents/projects`;

      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
      } as any);

      const result = await projectRelatedFoldersService.addRelatedFolder(projectId, folderPath);

      expect(result.success).toBe(true);
      expect(result.folder?.folderPath).toBe(expandedPath);
    });

    it('should reject path that is not a directory', async () => {
      const projectId = 'test-project-789';
      const filePath = '/path/to/file.txt';

      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => false,
      } as any);

      const result = await projectRelatedFoldersService.addRelatedFolder(projectId, filePath);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Path is not a directory');
      expect(result.folder).toBeUndefined();
    });

    it('should reject non-existent folder', async () => {
      const projectId = 'test-project-101';
      const nonExistentPath = '/path/that/does/not/exist';

      vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'));

      const result = await projectRelatedFoldersService.addRelatedFolder(
        projectId,
        nonExistentPath
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Folder does not exist or is not accessible');
      expect(result.folder).toBeUndefined();
    });

    it('should reject duplicate folder paths', async () => {
      const projectId = 'test-duplicate-project';
      const folderPath = '/path/to/folder';

      // Create project first
      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
      } as any);

      // Add folder first time
      await projectRelatedFoldersService.addRelatedFolder(projectId, folderPath);

      // Try to add same folder again
      const result = await projectRelatedFoldersService.addRelatedFolder(projectId, folderPath);

      expect(result.success).toBe(false);
      expect(result.error).toBe('This folder has already been added');
    });

    it('should detect duplicates after expanding tilde', async () => {
      const projectId = 'test-tilde-duplicate';
      const homeDir = os.homedir();

      // Create project first
      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      const expandedPath = `${homeDir}/Documents`;

      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
      } as any);

      // Add with expanded path
      await projectRelatedFoldersService.addRelatedFolder(projectId, expandedPath);

      // Try to add with tilde notation
      const result = await projectRelatedFoldersService.addRelatedFolder(projectId, '~/Documents');

      expect(result.success).toBe(false);
      expect(result.error).toBe('This folder has already been added');
    });

    it('should set timestamps correctly', async () => {
      const projectId = 'test-timestamps';
      const folderPath = '/test/folder';

      // Create project first
      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
      } as any);

      const beforeAdd = new Date();
      await new Promise(resolve => setTimeout(resolve, 10));

      const result = await projectRelatedFoldersService.addRelatedFolder(projectId, folderPath);

      await new Promise(resolve => setTimeout(resolve, 10));
      const afterAdd = new Date();

      expect(result.success).toBe(true);
      expect(result.folder?.createdAt.getTime()).toBeGreaterThanOrEqual(beforeAdd.getTime());
      expect(result.folder?.createdAt.getTime()).toBeLessThanOrEqual(afterAdd.getTime());
      expect(result.folder?.updatedAt).toEqual(result.folder?.createdAt);
    });

    it('should handle permission errors', async () => {
      const projectId = 'test-permission';
      const restrictedPath = '/restricted/folder';

      vi.mocked(fs.stat).mockRejectedValue(new Error('EACCES: permission denied'));

      const result = await projectRelatedFoldersService.addRelatedFolder(projectId, restrictedPath);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Folder does not exist or is not accessible');
    });
  });

  describe('removeRelatedFolder', () => {
    it('should remove a related folder', async () => {
      const projectId = 'test-remove-project';

      // Create project first
      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
      } as any);

      // Add a folder first
      const addResult = await projectRelatedFoldersService.addRelatedFolder(
        projectId,
        '/test/folder'
      );
      const folderId = addResult.folder!.id;

      // Verify it exists
      let folders = await projectRelatedFoldersService.getRelatedFolders(projectId);
      expect(folders).toHaveLength(1);

      // Remove it
      const removeResult = await projectRelatedFoldersService.removeRelatedFolder(folderId);

      expect(removeResult.success).toBe(true);
      expect(removeResult.error).toBeUndefined();

      // Verify it's gone
      folders = await projectRelatedFoldersService.getRelatedFolders(projectId);
      expect(folders).toHaveLength(0);
    });

    it('should succeed when removing non-existent folder', async () => {
      // Removing a non-existent folder should not throw an error
      const result = await projectRelatedFoldersService.removeRelatedFolder('nonexistent-id');

      expect(result.success).toBe(true);
    });

    it('should only remove specified folder, not others', async () => {
      const projectId = 'test-selective-remove';

      // Create project first
      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      vi.mocked(fs.stat).mockResolvedValue({
        isDirectory: () => true,
      } as any);

      // Add multiple folders
      const folder1 = await projectRelatedFoldersService.addRelatedFolder(projectId, '/folder1');
      const folder2 = await projectRelatedFoldersService.addRelatedFolder(projectId, '/folder2');
      const folder3 = await projectRelatedFoldersService.addRelatedFolder(projectId, '/folder3');

      // Remove middle one
      await projectRelatedFoldersService.removeRelatedFolder(folder2.folder!.id);

      // Verify only the specified one was removed
      const remaining = await projectRelatedFoldersService.getRelatedFolders(projectId);
      expect(remaining).toHaveLength(2);
      expect(remaining.map(f => f.folderPath)).toContain('/folder1');
      expect(remaining.map(f => f.folderPath)).toContain('/folder3');
      expect(remaining.map(f => f.folderPath)).not.toContain('/folder2');
    });
  });
});
