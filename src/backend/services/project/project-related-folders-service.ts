import { and, eq } from 'drizzle-orm';
import { db } from '../../../shared/database';
import { projectRelatedFolders } from '../../../shared/database/schema';
import { createId } from '@paralleldrive/cuid2';
import { expandTilde } from '../../utils/path-utils';
import * as fs from 'fs/promises';

export interface RelatedFolder {
  id: string;
  projectId: string;
  folderPath: string;
  createdAt: Date;
  updatedAt: Date;
}

class ProjectRelatedFoldersService {
  /**
   * Get all related folders for a project
   */
  async getRelatedFolders(projectId: string): Promise<RelatedFolder[]> {
    const folders = await db
      .select()
      .from(projectRelatedFolders)
      .where(eq(projectRelatedFolders.projectId, projectId))
      .orderBy(projectRelatedFolders.createdAt);

    return folders;
  }

  /**
   * Add a related folder to a project
   */
  async addRelatedFolder(
    projectId: string,
    folderPath: string
  ): Promise<{ success: boolean; error?: string; folder?: RelatedFolder }> {
    // Expand tilde in path
    const expandedPath = expandTilde(folderPath);

    // Validate that the folder exists
    try {
      const stats = await fs.stat(expandedPath);
      if (!stats.isDirectory()) {
        return { success: false, error: 'Path is not a directory' };
      }
    } catch {
      return { success: false, error: 'Folder does not exist or is not accessible' };
    }

    // Check for duplicates (using expanded path)
    const existing = await db
      .select()
      .from(projectRelatedFolders)
      .where(
        and(
          eq(projectRelatedFolders.projectId, projectId),
          eq(projectRelatedFolders.folderPath, expandedPath)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return { success: false, error: 'This folder has already been added' };
    }

    // Add the folder (using expanded path)
    const now = new Date();
    const folder: RelatedFolder = {
      id: createId(),
      projectId,
      folderPath: expandedPath,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(projectRelatedFolders).values(folder);

    return { success: true, folder };
  }

  /**
   * Remove a related folder from a project
   */
  async removeRelatedFolder(folderId: string): Promise<{ success: boolean; error?: string }> {
    await db.delete(projectRelatedFolders).where(eq(projectRelatedFolders.id, folderId));

    return { success: true };
  }
}

export const projectRelatedFoldersService = new ProjectRelatedFoldersService();
