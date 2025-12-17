import { and, eq } from 'drizzle-orm';
import { db } from '../../../shared/database';
import { projectExclusions } from '../../../shared/database/schema';
import { createId } from '@paralleldrive/cuid2';

export interface ProjectExclusion {
  id: string;
  projectId: string;
  path: string;
  createdAt: Date;
}

class ProjectExclusionsService {
  /**
   * Get all exclusions for a project
   */
  async getExclusions(projectId: string): Promise<ProjectExclusion[]> {
    const exclusions = await db
      .select()
      .from(projectExclusions)
      .where(eq(projectExclusions.projectId, projectId))
      .orderBy(projectExclusions.path);

    return exclusions;
  }

  /**
   * Add an exclusion to a project
   */
  async addExclusion(
    projectId: string,
    path: string
  ): Promise<{ success: boolean; error?: string; exclusion?: ProjectExclusion }> {
    // Normalize the path (remove leading/trailing slashes)
    const normalizedPath = path.replace(/^\/+|\/+$/g, '');

    if (!normalizedPath) {
      return { success: false, error: 'Path cannot be empty' };
    }

    // Check for duplicates
    const existing = await db
      .select()
      .from(projectExclusions)
      .where(
        and(eq(projectExclusions.projectId, projectId), eq(projectExclusions.path, normalizedPath))
      )
      .limit(1);

    if (existing.length > 0) {
      return { success: false, error: 'This path is already excluded' };
    }

    // Add the exclusion
    const exclusion: ProjectExclusion = {
      id: createId(),
      projectId,
      path: normalizedPath,
      createdAt: new Date(),
    };

    await db.insert(projectExclusions).values(exclusion);

    return { success: true, exclusion };
  }

  /**
   * Remove an exclusion by ID
   */
  async removeExclusion(exclusionId: string): Promise<{ success: boolean; error?: string }> {
    await db.delete(projectExclusions).where(eq(projectExclusions.id, exclusionId));

    return { success: true };
  }

  /**
   * Remove an exclusion by project ID and path
   */
  async removeExclusionByPath(
    projectId: string,
    path: string
  ): Promise<{ success: boolean; error?: string }> {
    const normalizedPath = path.replace(/^\/+|\/+$/g, '');

    await db
      .delete(projectExclusions)
      .where(
        and(eq(projectExclusions.projectId, projectId), eq(projectExclusions.path, normalizedPath))
      );

    return { success: true };
  }
}

export const projectExclusionsService = new ProjectExclusionsService();
