import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../../../shared/database';
import { projects, projectWorktrees } from '../../../shared/database/schema';
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
import { projectExclusionsService } from './project-exclusions-service';
import { projectWorktreesService } from './project-worktrees-service';

// Re-export types
export type { Technology } from './project-technology-service';
export type { ProjectStats } from './project-stats-service';
export type { RelatedFolder } from './project-related-folders-service';
export type { ProjectExclusion } from './project-exclusions-service';
export type { Worktree } from './project-worktrees-service';

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
  /** Set when the project's directory went missing; null while it is present. */
  missingSince?: Date | null;
  preferredIde?: string | null;
  preferredTerminal?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectWithDetails extends Project {
  technologies: import('./project-technology-service').Technology[];
  stats?: import('./project-stats-service').ProjectStats | null;
  /** Main checkout first. Empty for a project that is not a git repository. */
  worktrees?: import('./project-worktrees-service').Worktree[];
}

export interface ProjectFilters {
  search?: string;
  technologies?: string[];
  includeArchived?: boolean;
  /**
   * Include projects whose directory has gone missing. Excluded by default so
   * they stop inflating counts and totals; the rescan sets this to find them
   * again, and the UI sets it to show them for review.
   */
  includeMissing?: boolean;
}

class ProjectService {
  // Guards against concurrent/repeat saveProject calls for the same path
  // (e.g. overlapping scan + rescan, or a symlink-heavy tree revisiting the
  // same project) racing on the technologies delete-then-insert.
  private saveProjectLocks: Map<string, Promise<ProjectWithDetails>> = new Map();

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

    // A project whose directory is gone should not count towards totals.
    if (!filters?.includeMissing) {
      conditions.push(sql`${projects.missingSince} IS NULL`);
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
        const [techs, stats, worktrees] = await Promise.all([
          projectTechnologyService.getProjectTechnologies(project.id),
          projectStatsService.getProjectStats(project.id, false), // Don't include language stats in list view
          projectWorktreesService.getWorktrees(project.id),
        ]);

        return {
          ...project,
          technologies: techs,
          stats,
          worktrees,
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
    const [techs, stats, worktrees] = await Promise.all([
      projectTechnologyService.getProjectTechnologies(project.id),
      projectStatsService.getProjectStats(project.id),
      projectWorktreesService.getWorktrees(project.id),
    ]);

    return {
      ...project,
      technologies: techs,
      stats,
      worktrees,
    };
  }

  /**
   * Find the project whose root path matches or contains the given path.
   * Used to resolve "the project I'm currently in" from a cwd, without
   * requiring the caller to already know the project ID.
   */
  /**
   * Resolve a project by its own root path, ignoring containment.
   *
   * `getProjectByPath` answers "which project am I standing in", so it matches
   * parent projects and worktrees. Callers deciding whether a directory is
   * already its own project need the stricter question.
   */
  async getProjectByExactPath(path: string): Promise<ProjectWithDetails | null> {
    const normalizedPath = path.replace(/[/\\]+$/, '');

    const matches = await db
      .select()
      .from(projects)
      .where(sql`${projects.archivedAt} IS NULL AND ${projects.missingSince} IS NULL`);

    const match = matches.find(project => project.path.replace(/[/\\]+$/, '') === normalizedPath);

    return match ? this.getProjectById(match.id) : null;
  }

  async getProjectByPath(path: string): Promise<ProjectWithDetails | null> {
    // A missing project cannot be the one the caller is standing in.
    const allProjects = await db
      .select()
      .from(projects)
      .where(sql`${projects.archivedAt} IS NULL AND ${projects.missingSince} IS NULL`);

    const normalizedPath = path.replace(/[/\\]+$/, '');

    // Candidates are project roots plus every known worktree path. A linked
    // worktree usually lives outside its project's directory (a sibling, or an
    // entirely separate root), so matching on project paths alone would fail to
    // resolve anything running from inside one.
    const candidates: { projectId: string; path: string }[] = allProjects.map(project => ({
      projectId: project.id,
      path: project.path,
    }));

    const projectIds = new Set(allProjects.map(project => project.id));
    const worktrees = await db.select().from(projectWorktrees);
    for (const worktree of worktrees) {
      if (projectIds.has(worktree.projectId)) {
        candidates.push({ projectId: worktree.projectId, path: worktree.path });
      }
    }

    let bestMatch: { projectId: string; path: string } | null = null;
    for (const candidate of candidates) {
      const candidatePath = candidate.path.replace(/[/\\]+$/, '');
      const isMatch =
        normalizedPath === candidatePath ||
        normalizedPath.startsWith(candidatePath + '/') ||
        normalizedPath.startsWith(candidatePath + '\\');

      if (isMatch && (!bestMatch || candidatePath.length > bestMatch.path.length)) {
        bestMatch = candidate;
      }
    }

    if (!bestMatch) {
      return null;
    }

    return this.getProjectById(bestMatch.projectId);
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
    // If a save for this path is already in flight, wait for it instead of
    // running a concurrent save (avoids interleaved technology delete/insert).
    const existingLock = this.saveProjectLocks.get(projectInfo.path);
    if (existingLock) {
      return existingLock;
    }

    const savePromise = this.saveProjectInternal(projectInfo).finally(() => {
      this.saveProjectLocks.delete(projectInfo.path);
    });

    this.saveProjectLocks.set(projectInfo.path, savePromise);
    return savePromise;
  }

  private async saveProjectInternal(projectInfo: ProjectInfo): Promise<ProjectWithDetails> {
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

    // Record this repository's checkouts. Cheap for a non-git directory: git
    // fails and the sync leaves the (empty) rows alone.
    await projectWorktreesService.syncWorktrees(projectId, projectInfo.path, projectInfo.gitInfo);

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
   * Resolves which directory an "open" action should target.
   *
   * Defaults to the project root. A worktreePath is honoured only when it is one
   * of this project's own worktrees, so the caller cannot open an arbitrary
   * directory by passing a path.
   */
  private async resolveOpenTarget(
    project: ProjectWithDetails,
    worktreePath?: string
  ): Promise<{ path: string; preferredIde: string | null }> {
    if (!worktreePath) {
      return { path: project.path, preferredIde: project.preferredIde ?? null };
    }

    const worktree = (project.worktrees ?? []).find(candidate => candidate.path === worktreePath);
    if (!worktree) {
      throw new Error('Worktree not found for this project');
    }

    // A worktree may have its own IDE preference; fall back to the project's.
    return {
      path: worktree.path,
      preferredIde: worktree.preferredIde ?? project.preferredIde ?? null,
    };
  }

  /**
   * Open a project, or one of its worktrees, in the preferred IDE
   */
  async openProjectInIDE(id: string, ideId?: string, worktreePath?: string): Promise<void> {
    const project = await this.getProjectById(id);

    if (!project) {
      throw new Error('Project not found');
    }

    const target = await this.resolveOpenTarget(project, worktreePath);

    await projectToolsService.openProjectInIDE(target.path, target.preferredIde, ideId);
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
  async openTerminalAtProject(
    id: string,
    terminalId?: string,
    worktreePath?: string
  ): Promise<void> {
    const project = await this.getProjectById(id);

    if (!project) {
      throw new Error('Project not found');
    }

    const target = await this.resolveOpenTarget(project, worktreePath);

    await projectToolsService.openTerminalAtProject(
      target.path,
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
   * Get package.json scripts for a project, grouped by root and immediate
   * subdirectories (one level deep) to support monorepo layouts.
   */
  async getPackageScriptGroups(
    projectPath: string
  ): Promise<import('../../../shared/types/process').DetectedScriptGroup[]> {
    return projectPackageService.getPackageScriptGroups(projectPath);
  }

  /**
   * Get composer.json scripts for a project, grouped by root and immediate
   * subdirectories (one level deep) to support monorepo layouts.
   */
  async getComposerScriptGroups(
    projectPath: string
  ): Promise<import('../../../shared/types/process').DetectedScriptGroup[]> {
    return projectPackageService.getComposerScriptGroups(projectPath);
  }

  /**
   * Detect package manager from lock files. Pass `subPath` to detect the
   * package manager used by a specific workspace subdirectory.
   */
  async detectPackageManager(
    projectPath: string,
    subPath?: string
  ): Promise<'npm' | 'yarn' | 'pnpm'> {
    return projectPackageService.detectPackageManager(projectPath, subPath);
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

  /**
   * Flag a project whose directory is gone or unreadable.
   *
   * Deliberately not a delete: a rescan cannot distinguish a deleted folder from
   * an unmounted drive, and removing the row would cascade away the processes,
   * accounts and exclusions the user configured.
   */
  async markProjectMissing(id: string): Promise<void> {
    await db
      .update(projects)
      .set({ missingSince: new Date(), updatedAt: new Date() })
      .where(eq(projects.id, id));
  }

  /**
   * Clear the missing flag after a project's directory becomes readable again.
   */
  async markProjectFound(id: string): Promise<void> {
    await db
      .update(projects)
      .set({ missingSince: null, updatedAt: new Date() })
      .where(eq(projects.id, id));
  }

  /**
   * Get all worktrees for a project, main checkout first
   */
  async getWorktrees(projectId: string) {
    return projectWorktreesService.getWorktrees(projectId);
  }

  /**
   * Re-read a project's worktrees from git
   */
  async syncWorktrees(projectId: string, repoPath: string) {
    return projectWorktreesService.syncWorktrees(projectId, repoPath);
  }

  /**
   * Set the preferred IDE for a single worktree
   */
  async setWorktreePreferredIde(worktreeId: string, preferredIde: string | null) {
    return projectWorktreesService.setPreferredIde(worktreeId, preferredIde);
  }

  /**
   * Get all exclusions for a project
   */
  async getExclusions(projectId: string) {
    return projectExclusionsService.getExclusions(projectId);
  }

  /**
   * Add an exclusion to a project
   */
  async addExclusion(projectId: string, path: string) {
    return projectExclusionsService.addExclusion(projectId, path);
  }

  /**
   * Remove an exclusion from a project
   */
  async removeExclusion(exclusionId: string) {
    return projectExclusionsService.removeExclusion(exclusionId);
  }
}

export const projectService = new ProjectService();
