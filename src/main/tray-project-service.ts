import { shell } from 'electron';
import { projectService } from '../backend/services/project-service';
import type { ProjectWithDetails } from '../backend/services/project-service';
import { ideDetectorService } from '../backend/services/ide-detector-service';
import { terminalDetectorService } from '../backend/services/terminal-detector-service';

/**
 * Service for tray menu to interact with projects
 */

/**
 * Get favorite projects (up to limit)
 */
export async function getFavoriteProjects(limit = 10): Promise<ProjectWithDetails[]> {
  const allProjects = await projectService.getProjects();
  return allProjects.filter(p => p.isFavorite).slice(0, limit);
}

/**
 * Get recent projects (sorted by last modified, up to limit)
 */
export async function getRecentProjects(limit = 10): Promise<ProjectWithDetails[]> {
  const allProjects = await projectService.getProjects();
  // Projects are already sorted by lastModified in descending order
  return allProjects.slice(0, limit);
}

/**
 * Open project in its preferred IDE or default IDE
 */
export async function openProjectInIDE(projectId: string): Promise<void> {
  const project = await projectService.getProjectById(projectId);
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  // Get the IDE to use (preferred or first detected)
  const ides = ideDetectorService.getDetectedIDEs();
  let ideToUse = ides.find(ide => ide.id === project.preferredIde);

  if (!ideToUse && ides.length > 0) {
    ideToUse = ides[0]; // Use first available IDE
  }

  if (!ideToUse) {
    throw new Error('No IDE detected on system');
  }

  // Open the project using the IDE's command
  await shell.openPath(project.path);
}

/**
 * Open terminal at project path
 */
export async function openProjectTerminal(projectId: string): Promise<void> {
  const project = await projectService.getProjectById(projectId);
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  // Get the terminal to use
  const terminals = terminalDetectorService.getDetectedTerminals();
  let terminalToUse = terminals.find(term => term.id === project.preferredTerminal);

  if (!terminalToUse && terminals.length > 0) {
    terminalToUse = terminals[0]; // Use first available terminal
  }

  if (!terminalToUse) {
    throw new Error('No terminal detected on system');
  }

  // Open terminal at project path
  // This is a simplified version - you may want to use the actual terminal opening logic
  // from your backend routes
  await shell.openPath(project.path);
}

/**
 * Show project in Finder/Explorer
 */
export async function showProjectInFinder(projectId: string): Promise<void> {
  const project = await projectService.getProjectById(projectId);
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  await shell.showItemInFolder(project.path);
}

/**
 * Show project in the main Barnacles window
 */
export async function showProjectInApp(projectId: string): Promise<void> {
  const { BrowserWindow } = await import('electron');
  const windows = BrowserWindow.getAllWindows();

  if (windows.length > 0) {
    const mainWindow = windows[0];
    mainWindow.show();
    mainWindow.focus();

    // Navigate to the project (you'll need to implement IPC for this)
    mainWindow.webContents.send('navigate-to-project', projectId);
  } else {
    // Create a new window if none exist
    const { createAppWindow } = await import('./main');
    await createAppWindow();
  }
}
