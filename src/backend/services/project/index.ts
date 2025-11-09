import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../../shared/database';
import { projects } from '../../../shared/database/schema';
import type { ProjectInfo } from '../project-scanner-service';
import { projectScannerService } from '../project-scanner-service';
import { ideDetectorService } from '../ide-detector-service';
import { findProjectIcon } from '../../utils/icon-finder';
import { projectTechnologyService } from './project-technology-service';
import { projectStatsService } from './project-stats-service';
import { projectProcessService } from './project-process-service';
import { projectToolsService } from './project-tools-service';
import { projectFileSystemService } from './project-filesystem-service';
import { projectPackageService } from './project-package-service';
import { projectRelatedFoldersService } from './project-related-folders-service';

// Re-export types
export type { Technology } from './project-technology-service';
export type { ProjectStats } from './project-stats-service';
export type { RelatedFolder } from './project-related-folders-service';

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
  technologies: import('./project-technology-service').Technology[];
  stats?: import('./project-stats-service').ProjectStats | null;
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
          projectTechnologyService.getProjectTechnologies(project.id),
          projectStatsService.getProjectStats(project.id, false), // Don't include language stats in list view
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
      projectTechnologyService.getProjectTechnologies(project.id),
      projectStatsService.getProjectStats(project.id),
    ]);

    return {
      ...project,
      technologies: techs,
      stats,
    };
  }

  /**
   * Get all technologies
   */
  async getTechnologies() {
    return projectTechnologyService.getAllTechnologies();
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
      const updateData: Partial<typeof projects.$inferInsert> = {
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

    // Update technologies
    await projectTechnologyService.updateProjectTechnologies(projectId, projectInfo.technologies);

    // Save or update project stats
    await projectStatsService.saveProjectStats(projectId, projectInfo);

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
    return projectToolsService.updatePreferredIDE(id, ideId);
  }

  /**
   * Get all detected IDEs on the system
   */
  async getDetectedIDEs() {
    return projectToolsService.getDetectedIDEs();
  }

  /**
   * Get all available IDE definitions
   */
  getAvailableIDEs() {
    return projectToolsService.getAvailableIDEs();
  }

  /**
   * Open a project in its preferred IDE
   */
  async openProjectInIDE(id: string, ideId?: string): Promise<void> {
    const project = await this.getProjectById(id);

    if (!project) {
      throw new Error('Project not found');
    }

    await projectToolsService.openProjectInIDE(project.path, project.preferredIde, ideId);
  }

  /**
   * Update the preferred terminal for a project
   */
  async updatePreferredTerminal(id: string, terminalId: string | null): Promise<void> {
    return projectToolsService.updatePreferredTerminal(id, terminalId);
  }

  /**
   * Get all detected terminals on the system
   */
  async getDetectedTerminals() {
    return projectToolsService.getDetectedTerminals();
  }

  /**
   * Get all available terminal definitions
   */
  getAvailableTerminals() {
    return projectToolsService.getAvailableTerminals();
  }

  /**
   * Open a terminal at the project path
   */
  async openTerminalAtProject(id: string, terminalId?: string): Promise<void> {
    const project = await this.getProjectById(id);

    if (!project) {
      throw new Error('Project not found');
    }

    await projectToolsService.openTerminalAtProject(
      project.path,
      project.preferredTerminal,
      terminalId
    );
  }

  /**
   * Get README.md content for a project
   */
  async getProjectReadme(id: string): Promise<string | null> {
    const project = await this.getProjectById(id);

    if (!project) {
      throw new Error('Project not found');
    }

    return projectFileSystemService.getProjectReadme(project.path);
  }

  /**
   * Get the start processes configuration for a project
   */
  async getStartProcesses(projectId: string) {
    return projectProcessService.getStartProcesses(projectId);
  }

  /**
   * Update the start processes configuration for a project
   */
  async updateStartProcesses(
    id: string,
    startProcessesData: import('../../../shared/types/process').StartProcess[]
  ): Promise<void> {
    return projectProcessService.updateStartProcesses(id, startProcessesData);
  }

  /**
   * Get package.json scripts for a project
   */
  async getPackageScripts(projectPath: string): Promise<Record<string, string>> {
    return projectPackageService.getPackageScripts(projectPath);
  }

  /**
   * Get composer.json scripts for a project
   */
  async getComposerScripts(projectPath: string): Promise<Record<string, string>> {
    return projectPackageService.getComposerScripts(projectPath);
  }

  /**
   * Detect package manager from lock files
   */
  async detectPackageManager(projectPath: string): Promise<'npm' | 'yarn' | 'pnpm'> {
    return projectPackageService.detectPackageManager(projectPath);
  }

  /**
   * Delete third-party packages from a project and recalculate stats
   */
  async deleteThirdPartyPackages(id: string): Promise<{ deletedSize: number }> {
    const project = await this.getProjectById(id);

    if (!project) {
      throw new Error('Project not found');
    }

    const result = await projectFileSystemService.deleteThirdPartyPackages(project.path);

    // Rescan the project to update stats
    await this.rescanProject(project.path);

    return result;
  }

  /**
   * Get all related folders for a project
   */
  async getRelatedFolders(projectId: string) {
    return projectRelatedFoldersService.getRelatedFolders(projectId);
  }

  /**
   * Add a related folder to a project
   */
  async addRelatedFolder(projectId: string, folderPath: string) {
    return projectRelatedFoldersService.addRelatedFolder(projectId, folderPath);
  }

  /**
   * Remove a related folder from a project
   */
  async removeRelatedFolder(folderId: string) {
    return projectRelatedFoldersService.removeRelatedFolder(folderId);
  }
}

export const projectService = new ProjectService();
