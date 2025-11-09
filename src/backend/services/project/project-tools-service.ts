import { eq } from 'drizzle-orm';
import { db } from '../../../shared/database';
import { projects } from '../../../shared/database/schema';
import { ideDetectorService } from '../ide-detector-service';
import { terminalDetectorService } from '../terminal-detector-service';

class ProjectToolsService {
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
   * Update the preferred IDE for a project
   */
  async updatePreferredIDE(projectId: string, ideId: string | null): Promise<void> {
    await db
      .update(projects)
      .set({ preferredIde: ideId, updatedAt: new Date() })
      .where(eq(projects.id, projectId));
  }

  /**
   * Open a project in its preferred IDE
   */
  async openProjectInIDE(
    projectPath: string,
    preferredIde: string | null,
    ideId?: string
  ): Promise<void> {
    const ideToUse = ideId || preferredIde;

    if (!ideToUse) {
      throw new Error('No IDE specified for this project');
    }

    await ideDetectorService.openProjectInIDE(projectPath, ideToUse);
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
   * Update the preferred terminal for a project
   */
  async updatePreferredTerminal(projectId: string, terminalId: string | null): Promise<void> {
    await db
      .update(projects)
      .set({ preferredTerminal: terminalId, updatedAt: new Date() })
      .where(eq(projects.id, projectId));
  }

  /**
   * Open a terminal at the project path
   */
  async openTerminalAtProject(
    projectPath: string,
    preferredTerminal: string | null,
    terminalId?: string
  ): Promise<void> {
    const terminalToUse = terminalId || preferredTerminal;

    if (!terminalToUse) {
      throw new Error('No terminal specified for this project');
    }

    await terminalDetectorService.openTerminalAtPath(terminalToUse, projectPath);
  }
}

export const projectToolsService = new ProjectToolsService();
