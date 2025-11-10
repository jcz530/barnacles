import { eq } from 'drizzle-orm';
import { db } from '../../../shared/database';
import { projectTechnologies, technologies } from '../../../shared/database/schema';
import { projectScannerService } from '../project-scanner-service';

export interface Technology {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  color?: string | null;
}

class ProjectTechnologyService {
  /**
   * Get all technologies
   */
  async getAllTechnologies(): Promise<Technology[]> {
    return await db.select().from(technologies);
  }

  /**
   * Get technologies for a project
   */
  async getProjectTechnologies(projectId: string): Promise<Technology[]> {
    const result = await db
      .select({
        id: technologies.id,
        name: technologies.name,
        slug: technologies.slug,
        icon: technologies.icon,
        color: technologies.color,
      })
      .from(projectTechnologies)
      .innerJoin(technologies, eq(projectTechnologies.technologyId, technologies.id))
      .where(eq(projectTechnologies.projectId, projectId));

    return result;
  }

  /**
   * Ensure technology exists in database
   */
  async ensureTechnology(techSlug: string): Promise<string> {
    // Check if technology exists
    const existing = await db
      .select()
      .from(technologies)
      .where(eq(technologies.slug, techSlug))
      .limit(1);

    if (existing.length > 0) {
      return existing[0].id;
    }

    // Get technology info from scanner service
    const detectors = projectScannerService.getTechnologyDetectors();
    const detector = detectors.find(d => d.slug === techSlug);

    if (!detector) {
      throw new Error(`Unknown technology: ${techSlug}`);
    }

    try {
      // Create new technology
      const result = await db
        .insert(technologies)
        .values({
          name: detector.name,
          slug: detector.slug,
          icon: detector.icon,
          color: detector.color,
        })
        .returning();

      return result[0].id;
    } catch (error: unknown) {
      // Handle race condition: if another process inserted it, fetch it again
      // Check if it's a UNIQUE constraint error (check both direct code and cause.code)
      const isUniqueConstraintError =
        error &&
        typeof error === 'object' &&
        (('code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') ||
          ('cause' in error &&
            error.cause &&
            typeof error.cause === 'object' &&
            'code' in error.cause &&
            error.cause.code === 'SQLITE_CONSTRAINT_UNIQUE'));

      if (isUniqueConstraintError) {
        const retry = await db
          .select()
          .from(technologies)
          .where(eq(technologies.slug, techSlug))
          .limit(1);

        if (retry.length > 0) {
          return retry[0].id;
        }
      }

      throw error;
    }
  }

  /**
   * Update technologies for a project
   */
  async updateProjectTechnologies(projectId: string, techSlugs: string[]): Promise<void> {
    // Delete existing project technologies
    await db.delete(projectTechnologies).where(eq(projectTechnologies.projectId, projectId));

    // Add technologies
    for (const techSlug of techSlugs) {
      const techId = await this.ensureTechnology(techSlug);

      await db.insert(projectTechnologies).values({
        projectId,
        technologyId: techId,
      });
    }
  }
}

export const projectTechnologyService = new ProjectTechnologyService();
