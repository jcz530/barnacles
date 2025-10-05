import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../shared/database';
import {
  projects,
  projectStats,
  projectTechnologies,
  technologies,
} from '../../shared/database/schema';
import type { ProjectInfo } from './project-scanner-service';
import { projectScannerService } from './project-scanner-service';
import { ideDetectorService } from './ide-detector-service';
import { terminalDetectorService } from './terminal-detector-service';
import { findProjectIcon } from '../utils/icon-finder';

export interface Project {
  id: string;
  name: string;
  path: string;
  description?: string | null;
  icon?: string | null;
  lastModified?: Date | null;
  size?: number | null;
  isFavorite: boolean;
  archivedAt?: Date | null;
  preferredIde?: string | null;
  preferredTerminal?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectWithDetails extends Project {
  technologies: Technology[];
  stats?: ProjectStats | null;
}

export interface Technology {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  color?: string | null;
}

export interface ProjectStats {
  id: string;
  projectId: string;
  fileCount?: number | null;
  directoryCount?: number | null;
  gitBranch?: string | null;
  gitStatus?: string | null;
  lastCommitDate?: Date | null;
  lastCommitMessage?: string | null;
  hasUncommittedChanges?: boolean | null;
}

export interface ProjectFilters {
  search?: string;
  technologies?: string[];
  includeArchived?: boolean;
}

class ProjectService {
  /**
   * Get all projects with optional filters
   */
  async getProjects(filters?: ProjectFilters): Promise<ProjectWithDetails[]> {
    let query = db.select().from(projects);

    // Apply filters
    const conditions = [];

    // By default, exclude archived projects unless explicitly requested
    if (!filters?.includeArchived) {
      conditions.push(sql`${projects.archivedAt} IS NULL`);
    }

    if (filters?.search) {
      conditions.push(
        sql`(${projects.name} LIKE ${'%' + filters.search + '%'} OR ${projects.path} LIKE ${'%' + filters.search + '%'})`
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    // Order by last modified
    query = query.orderBy(desc(projects.lastModified)) as typeof query;

    const projectResults = await query;

    // Get technologies for each project
    const projectsWithDetails = await Promise.all(
      projectResults.map(async project => {
        const [techs, stats] = await Promise.all([
          this.getProjectTechnologies(project.id),
          this.getProjectStats(project.id),
        ]);

        return {
          ...project,
          technologies: techs,
          stats,
        };
      })
    );

    // Filter by technologies if specified
    if (filters?.technologies && filters.technologies.length > 0) {
      return projectsWithDetails.filter(project =>
        filters.technologies!.some(techSlug =>
          project.technologies.some(tech => tech.slug === techSlug)
        )
      );
    }

    return projectsWithDetails;
  }

  /**
   * Get a single project by ID
   */
  async getProjectById(id: string): Promise<ProjectWithDetails | null> {
    const result = await db.select().from(projects).where(eq(projects.id, id)).limit(1);

    if (result.length === 0) {
      return null;
    }

    const project = result[0];
    const [techs, stats] = await Promise.all([
      this.getProjectTechnologies(project.id),
      this.getProjectStats(project.id),
    ]);

    return {
      ...project,
      technologies: techs,
      stats,
    };
  }

  /**
   * Get technologies for a project
   */
  private async getProjectTechnologies(projectId: string): Promise<Technology[]> {
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
   * Get stats for a project
   */
  private async getProjectStats(projectId: string): Promise<ProjectStats | null> {
    const result = await db
      .select()
      .from(projectStats)
      .where(eq(projectStats.projectId, projectId))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Get all technologies
   */
  async getTechnologies(): Promise<Technology[]> {
    return await db.select().from(technologies);
  }

  /**
   * Ensure technology exists in database
   */
  private async ensureTechnology(techSlug: string): Promise<string> {
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
   * Save scanned project to database
   */
  async saveProject(projectInfo: ProjectInfo): Promise<ProjectWithDetails> {
    // Detect preferred IDE from project files
    const detectedIde = await ideDetectorService.detectPreferredIDE(projectInfo.path);

    // Find project icon
    const iconPath = await findProjectIcon(projectInfo.path);

    // Check if project already exists by path
    const existing = await db
      .select()
      .from(projects)
      .where(eq(projects.path, projectInfo.path))
      .limit(1);

    let projectId: string;

    if (existing.length > 0) {
      // Update existing project
      projectId = existing[0].id;

      await db
        .update(projects)
        .set({
          name: projectInfo.name,
          description: projectInfo.description,
          icon: iconPath,
          lastModified: projectInfo.stats.lastModified,
          size: projectInfo.stats.size,
          // Only update preferredIde if it was detected and not already set
          preferredIde: existing[0].preferredIde || detectedIde,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, projectId));
    } else {
      // Create new project
      const result = await db
        .insert(projects)
        .values({
          name: projectInfo.name,
          path: projectInfo.path,
          description: projectInfo.description,
          icon: iconPath,
          lastModified: projectInfo.stats.lastModified,
          size: projectInfo.stats.size,
          preferredIde: detectedIde,
        })
        .returning();

      projectId = result[0].id;
    }

    // Delete existing project technologies
    await db.delete(projectTechnologies).where(eq(projectTechnologies.projectId, projectId));

    // Add technologies
    for (const techSlug of projectInfo.technologies) {
      const techId = await this.ensureTechnology(techSlug);

      await db.insert(projectTechnologies).values({
        projectId,
        technologyId: techId,
      });
    }

    // Save or update project stats
    const existingStats = await db
      .select()
      .from(projectStats)
      .where(eq(projectStats.projectId, projectId))
      .limit(1);

    const statsData = {
      fileCount: projectInfo.stats.fileCount,
      directoryCount: projectInfo.stats.directoryCount,
      languageStats: JSON.stringify(projectInfo.stats.languageStats),
      gitBranch: projectInfo.gitInfo?.branch,
      gitStatus: projectInfo.gitInfo?.status,
      gitRemoteUrl: projectInfo.gitInfo?.remoteUrl,
      lastCommitDate: projectInfo.gitInfo?.lastCommitDate,
      lastCommitMessage: projectInfo.gitInfo?.lastCommitMessage,
      hasUncommittedChanges: projectInfo.gitInfo?.hasUncommittedChanges,
      updatedAt: new Date(),
    };

    if (existingStats.length > 0) {
      await db.update(projectStats).set(statsData).where(eq(projectStats.projectId, projectId));
    } else {
      await db.insert(projectStats).values({
        ...statsData,
        projectId,
      });
    }

    // Return the complete project
    const project = await this.getProjectById(projectId);
    if (!project) {
      throw new Error('Failed to retrieve saved project');
    }

    return project;
  }

  /**
   * Delete a project
   */
  async deleteProject(id: string): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }

  /**
   * Archive a project
   */
  async archiveProject(id: string): Promise<void> {
    await db
      .update(projects)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(projects.id, id));
  }

  /**
   * Unarchive a project
   */
  async unarchiveProject(id: string): Promise<void> {
    await db
      .update(projects)
      .set({ archivedAt: null, updatedAt: new Date() })
      .where(eq(projects.id, id));
  }

  /**
   * Toggle project favorite status
   */
  async toggleProjectFavorite(id: string): Promise<boolean> {
    const project = await db.select().from(projects).where(eq(projects.id, id)).limit(1);

    if (project.length === 0) {
      throw new Error('Project not found');
    }

    const newFavoriteStatus = !project[0].isFavorite;

    await db
      .update(projects)
      .set({ isFavorite: newFavoriteStatus, updatedAt: new Date() })
      .where(eq(projects.id, id));

    return newFavoriteStatus;
  }

  /**
   * Scan directories and save all found projects
   */
  async scanAndSaveProjects(
    directories: string[],
    maxDepth: number = 2
  ): Promise<ProjectWithDetails[]> {
    const scannedProjects = await projectScannerService.scanDirectories(directories, maxDepth);

    const savedProjects = await Promise.all(
      scannedProjects.map(projectInfo => this.saveProject(projectInfo))
    );

    return savedProjects;
  }

  /**
   * Rescan a single project by its path
   */
  async rescanProject(projectPath: string): Promise<ProjectWithDetails> {
    const projectInfo = await projectScannerService.scanProject(projectPath);

    if (!projectInfo) {
      throw new Error('Failed to scan project');
    }

    const savedProject = await this.saveProject(projectInfo);
    return savedProject;
  }

  /**
   * Update the preferred IDE for a project
   */
  async updatePreferredIDE(id: string, ideId: string | null): Promise<void> {
    await db
      .update(projects)
      .set({ preferredIde: ideId, updatedAt: new Date() })
      .where(eq(projects.id, id));
  }

  /**
   * Get all detected IDEs on the system
   */
  async getDetectedIDEs() {
    return await ideDetectorService.detectInstalledIDEs();
  }

  /**
   * Get all available IDE definitions
   */
  getAvailableIDEs() {
    return ideDetectorService.getAvailableIDEs();
  }

  /**
   * Open a project in its preferred IDE
   */
  async openProjectInIDE(id: string, ideId?: string): Promise<void> {
    const project = await this.getProjectById(id);

    if (!project) {
      throw new Error('Project not found');
    }

    const ideToUse = ideId || project.preferredIde;

    if (!ideToUse) {
      throw new Error('No IDE specified for this project');
    }

    await ideDetectorService.openProjectInIDE(project.path, ideToUse);
  }

  /**
   * Update the preferred terminal for a project
   */
  async updatePreferredTerminal(id: string, terminalId: string | null): Promise<void> {
    await db
      .update(projects)
      .set({ preferredTerminal: terminalId, updatedAt: new Date() })
      .where(eq(projects.id, id));
  }

  /**
   * Get all detected terminals on the system
   */
  async getDetectedTerminals() {
    return await terminalDetectorService.detectInstalledTerminals();
  }

  /**
   * Get all available terminal definitions
   */
  getAvailableTerminals() {
    return terminalDetectorService.getAvailableTerminals();
  }

  /**
   * Open a terminal at the project path
   */
  async openTerminalAtProject(id: string, terminalId?: string): Promise<void> {
    const project = await this.getProjectById(id);

    if (!project) {
      throw new Error('Project not found');
    }

    const terminalToUse = terminalId || project.preferredTerminal;

    if (!terminalToUse) {
      throw new Error('No terminal specified for this project');
    }

    await terminalDetectorService.openTerminalAtPath(terminalToUse, project.path);
  }

  /**
   * Get README.md content for a project
   */
  async getProjectReadme(id: string): Promise<string | null> {
    const project = await this.getProjectById(id);

    if (!project) {
      throw new Error('Project not found');
    }

    const fs = await import('fs/promises');
    const path = await import('path');

    // Try common README file names
    const readmeFiles = ['README.md', 'readme.md', 'Readme.md', 'README.MD'];

    for (const filename of readmeFiles) {
      try {
        const readmePath = path.join(project.path, filename);
        const content = await fs.readFile(readmePath, 'utf-8');
        return content;
      } catch {
        // File doesn't exist, try next
      }
    }

    return null;
  }
}

export const projectService = new ProjectService();
