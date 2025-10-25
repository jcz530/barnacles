import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../shared/database';
import {
  projectLanguageStats,
  projectProcessCommands,
  projectProcesses,
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
import type { StartProcess } from '../../shared/types/process';
import { createId } from '@paralleldrive/cuid2';

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
  languageStats?: Record<string, { fileCount: number; percentage: number; linesOfCode: number }>;
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
          this.getProjectStats(project.id, false), // Don't include language stats in list view
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
  private async getProjectStats(
    projectId: string,
    includeLanguageStats: boolean = true
  ): Promise<ProjectStats | null> {
    const result = await db
      .select()
      .from(projectStats)
      .where(eq(projectStats.projectId, projectId))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    let languageStats:
      | Record<string, { fileCount: number; percentage: number; linesOfCode: number }>
      | undefined = undefined;

    // Only fetch language stats if requested
    if (includeLanguageStats) {
      // Fetch language stats from the new table
      const langStats = await db
        .select()
        .from(projectLanguageStats)
        .where(eq(projectLanguageStats.projectId, projectId));

      // Convert to the expected format for backward compatibility
      const stats: Record<string, { fileCount: number; percentage: number; linesOfCode: number }> =
        {};

      for (const stat of langStats) {
        stats[stat.technologySlug] = {
          fileCount: stat.fileCount,
          percentage: stat.percentage / 10, // Convert back from integer storage (525 -> 52.5)
          linesOfCode: stat.linesOfCode,
        };
      }

      languageStats = stats;
    }

    return {
      ...result[0],
      languageStats,
    };
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

      // Build update object, only including fields that are provided
      const updateData: Record<string, any> = {
        name: projectInfo.name,
        description: projectInfo.description,
        icon: iconPath,
        lastModified: projectInfo.stats.lastModified,
        // Only update preferredIde if it was detected and not already set
        preferredIde: existing[0].preferredIde || detectedIde,
        updatedAt: new Date(),
      };

      // Only update size if it's provided (not undefined)
      if (projectInfo.stats.size !== undefined) {
        updateData.size = projectInfo.stats.size;
      }

      await db.update(projects).set(updateData).where(eq(projects.id, projectId));
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

    // Build stats data, only including fields that are provided
    const statsData: Record<string, any> = {
      gitBranch: projectInfo.gitInfo?.branch,
      gitStatus: projectInfo.gitInfo?.status,
      gitRemoteUrl: projectInfo.gitInfo?.remoteUrl,
      lastCommitDate: projectInfo.gitInfo?.lastCommitDate,
      lastCommitMessage: projectInfo.gitInfo?.lastCommitMessage,
      hasUncommittedChanges: projectInfo.gitInfo?.hasUncommittedChanges,
      updatedAt: new Date(),
    };

    // Only update these fields if they're provided (not undefined)
    if (projectInfo.stats.fileCount !== undefined) {
      statsData.fileCount = projectInfo.stats.fileCount;
    }
    if (projectInfo.stats.directoryCount !== undefined) {
      statsData.directoryCount = projectInfo.stats.directoryCount;
    }
    if (projectInfo.stats.linesOfCode !== undefined) {
      statsData.linesOfCode = projectInfo.stats.linesOfCode;
    }
    if (projectInfo.stats.thirdPartySize !== undefined) {
      statsData.thirdPartySize = projectInfo.stats.thirdPartySize;
    }

    if (existingStats.length > 0) {
      await db.update(projectStats).set(statsData).where(eq(projectStats.projectId, projectId));
    } else {
      await db.insert(projectStats).values({
        ...statsData,
        projectId,
      });
    }

    // Only update language stats if they're provided and not empty
    // (lightweight scans pass empty objects, so we should preserve existing data)
    const hasLanguageStats =
      projectInfo.stats.languageStats && Object.keys(projectInfo.stats.languageStats).length > 0;

    if (hasLanguageStats) {
      // Delete existing language stats and insert new ones
      await db.delete(projectLanguageStats).where(eq(projectLanguageStats.projectId, projectId));

      // Insert new language stats
      for (const [techSlug, stats] of Object.entries(projectInfo.stats.languageStats)) {
        await db.insert(projectLanguageStats).values({
          projectId,
          technologySlug: techSlug,
          fileCount: stats.fileCount,
          percentage: Math.round(stats.percentage * 10), // Store as integer (e.g., 52.5 -> 525)
          linesOfCode: stats.linesOfCode,
        });
      }
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
    maxDepth: number = 3
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

  /**
   * Get the start processes configuration for a project
   */
  async getStartProcesses(projectId: string): Promise<StartProcess[]> {
    const processes = await db
      .select()
      .from(projectProcesses)
      .where(eq(projectProcesses.projectId, projectId))
      .orderBy(projectProcesses.order);

    const result: StartProcess[] = [];

    for (const process of processes) {
      const commands = await db
        .select()
        .from(projectProcessCommands)
        .where(eq(projectProcessCommands.processId, process.id))
        .orderBy(projectProcessCommands.order);

      result.push({
        id: process.id,
        name: process.name,
        commands: commands.map(c => c.command),
        workingDir: process.workingDir ?? undefined,
        color: process.color ?? undefined,
        url: process.url ?? undefined,
      });
    }

    return result;
  }

  /**
   * Update the start processes configuration for a project
   */
  async updateStartProcesses(id: string, startProcessesData: StartProcess[]): Promise<void> {
    // Delete existing processes and commands (cascade will handle commands)
    await db.delete(projectProcesses).where(eq(projectProcesses.projectId, id));

    // Insert new processes and commands
    for (let i = 0; i < startProcessesData.length; i++) {
      const process = startProcessesData[i];

      // Insert process
      await db.insert(projectProcesses).values({
        id: process.id,
        projectId: id,
        name: process.name,
        workingDir: process.workingDir ?? null,
        color: process.color ?? null,
        url: process.url ?? null,
        order: i,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Insert commands
      for (let j = 0; j < process.commands.length; j++) {
        await db.insert(projectProcessCommands).values({
          id: createId(),
          processId: process.id,
          command: process.commands[j],
          order: j,
          createdAt: new Date(),
        });
      }
    }

    // Update project's updatedAt timestamp
    await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, id));
  }

  /**
   * Delete third-party packages from a project and recalculate stats
   */
  async deleteThirdPartyPackages(id: string): Promise<{ deletedSize: number }> {
    const project = await this.getProjectById(id);

    if (!project) {
      throw new Error('Project not found');
    }

    const fs = await import('fs/promises');
    const path = await import('path');

    const thirdPartyDirs = [
      'node_modules',
      'vendor',
      '.venv',
      'venv',
      'target/debug',
      'target/release',
    ];
    let deletedSize = 0;

    for (const dir of thirdPartyDirs) {
      const dirPath = path.join(project.path, dir);
      try {
        await fs.access(dirPath);
        // Calculate size before deleting
        const size = await projectScannerService.getThirdPartySizeByPath(project.path);
        // Delete the directory
        await fs.rm(dirPath, { recursive: true, force: true });
        deletedSize = size;
      } catch {
        // Directory doesn't exist or couldn't be deleted, skip
      }
    }

    // Rescan the project to update stats
    await this.rescanProject(project.path);

    return { deletedSize };
  }
}

export const projectService = new ProjectService();
