import { projectService } from './project-service';
import { projectScanWebSocketService } from './project-scan-websocket-service';
import { settingsService } from './settings-service';
import { getDefaultScanDirectories } from '../utils/default-scan-directories';
import { projectScannerService } from './project-scanner-service';

export class ProjectRescanSchedulerService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private defaultIntervalMinutes = 30;

  /**
   * Start the periodic rescan scheduler
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Rescan scheduler is already running');
      return;
    }

    // Get rescan interval from settings
    const intervalMinutes =
      (await settingsService.getValue<number>('rescanIntervalMinutes')) ||
      this.defaultIntervalMinutes;

    const intervalMs = intervalMinutes * 60 * 1000;

    console.log(`✅ Starting project rescan scheduler (interval: ${intervalMinutes} minutes)`);

    this.isRunning = true;

    // Check if this is first run (no projects in database) and trigger initial scan
    setTimeout(async () => {
      if (this.isRunning) {
        await this.checkAndRunFirstScan();
        this.rescanAllProjects();
      }
    }, 10000);

    // Set up periodic rescanning
    this.intervalId = setInterval(() => {
      this.rescanAllProjects();
    }, intervalMs);
  }

  /**
   * Check if this is the first run and trigger initial scan if needed
   */
  private async checkAndRunFirstScan(): Promise<void> {
    try {
      const projects = await projectService.getProjects({ includeArchived: true });

      if (projects.length === 0) {
        console.log('🔍 First run detected - starting initial project scan...');
        await this.performInitialScan();
      }
    } catch (error) {
      console.error('Error checking for first run:', error);
    }
  }

  /**
   * Perform initial scan on first app launch
   */
  private async performInitialScan(): Promise<void> {
    try {
      // Get maxDepth from settings or use default
      const maxDepth = (await settingsService.getValue<number>('scanMaxDepth')) ?? 3;

      // Perform the scan and save projects
      const savedProjects = await projectService.scanAndSaveProjects(
        getDefaultScanDirectories(),
        maxDepth
      );

      console.log(`✅ Initial scan completed: ${savedProjects.length} projects discovered`);

      // Broadcast scan completion to any connected clients
      projectScanWebSocketService.broadcast({
        type: 'scan-completed',
        totalDiscovered: savedProjects.length,
      });
    } catch (error) {
      console.error('Error during initial scan:', error);
    }
  }

  /**
   * Stop the periodic rescan scheduler
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    console.log('✅ Stopped project rescan scheduler');
  }

  /**
   * Rescan all existing projects
   */
  private async rescanAllProjects(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    console.log('🔄 Starting periodic rescan of all projects...');

    try {
      // Get all projects from database (including archived)
      const projects = await projectService.getProjects({ includeArchived: true });

      let updatedCount = 0;
      let errorCount = 0;

      for (const project of projects) {
        try {
          // Perform a lightweight rescan (just essential info)
          const projectInfo = await this.lightweightProjectScan(project.path);

          if (projectInfo) {
            // Update project in database
            await projectService.saveProject(projectInfo);
            updatedCount++;

            // Broadcast update via WebSocket
            projectScanWebSocketService.broadcast({
              type: 'project-updated',
              projectPath: project.path,
              projectData: projectInfo,
            });
          }
        } catch (error) {
          console.error(`Error rescanning project ${project.path}:`, error);
          errorCount++;
        }
      }

      console.log(`✅ Periodic rescan completed: ${updatedCount} updated, ${errorCount} errors`);
    } catch (error) {
      console.error('Error during periodic rescan:', error);
    }
  }

  /**
   * Perform a lightweight scan of a project (only essential information)
   * This is faster than a full scan and suitable for periodic updates
   */
  private async lightweightProjectScan(projectPath: string): Promise<any | null> {
    const fs = await import('fs/promises');
    const path = await import('path');

    try {
      // Check if project still exists
      await fs.access(projectPath);

      // Check if it's still a valid project
      const isValid = await projectScannerService.isValidProject(projectPath);
      if (!isValid) {
        return null;
      }

      // Get basic metadata
      const metadata = await projectScannerService.getProjectMetadata(projectPath);

      // Get git info (lightweight)
      const gitInfo = await projectScannerService.getGitInfo(projectPath);

      // Get last modified time from filesystem
      const stats = await fs.stat(projectPath);

      // Get existing project to preserve technologies
      const existingProjects = await projectService.getProjects({
        search: projectPath,
        includeArchived: true,
      });
      const existingProject = existingProjects.find(p => p.path === projectPath);

      // Return lightweight project info
      return {
        ...metadata,
        path: projectPath,
        technologies: existingProject?.technologies.map(t => t.slug) || [],
        stats: {
          fileCount: existingProject?.stats?.fileCount || 0,
          directoryCount: existingProject?.stats?.directoryCount || 0,
          size: 0, // Don't recalculate size for performance
          lastModified: stats.mtime,
          languageStats: {},
          linesOfCode: existingProject?.stats?.linesOfCode || 0,
          thirdPartySize: 0,
        },
        gitInfo,
      };
    } catch (error) {
      // Project no longer exists or can't be accessed
      return null;
    }
  }

  /**
   * Manually trigger a rescan of all projects (useful for testing)
   */
  async triggerManualRescan(): Promise<void> {
    await this.rescanAllProjects();
  }

  /**
   * Update rescan interval
   */
  async updateInterval(minutes: number): Promise<void> {
    await settingsService.setSetting('rescanIntervalMinutes', minutes, 'number');

    // Restart scheduler with new interval
    if (this.isRunning) {
      this.stop();
      await this.start();
    }
  }

  /**
   * Get current scheduler status
   */
  getStatus(): { isRunning: boolean; intervalMinutes: number } {
    return {
      isRunning: this.isRunning,
      intervalMinutes: this.defaultIntervalMinutes,
    };
  }
}

export const projectRescanSchedulerService = new ProjectRescanSchedulerService();
