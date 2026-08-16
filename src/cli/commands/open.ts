import { spawn } from 'child_process';
import { log } from '@clack/prompts';
import { Command } from '../core/Command.js';
import { brandGradient, colors } from '../utils/colors.js';
import { apiClient } from '../utils/api-client.js';
import { API_ROUTES } from '../../shared/constants/index.js';
import type { ProjectWithDetails } from '../../shared/types/api.js';

/**
 * Command to open the Barnacles application
 */
export class OpenCommand extends Command {
  readonly name = 'open';
  readonly description = 'Open the Barnacles application, or a specific project';
  readonly aliases = ['o'];
  readonly showIntro = false;
  readonly helpText =
    'Opens the Barnacles app. Pass a project name to focus the app on that project.';
  readonly examples = ['barnacles open', 'barnacles open my-project', 'barnacles o my-project'];

  async execute(
    _flags: Record<string, string | boolean>,
    positional: string[] = []
  ): Promise<void> {
    const query = positional[0];

    if (query) {
      await this.openProject(query);
      return;
    }

    console.log(
      `${colors.primary('Opening')} ${brandGradient('Barnacles')}${colors.primary('...')}`
    );

    if (process.platform === 'darwin') {
      // macOS: 'open -a' will launch if not running, or focus if already running
      spawn('open', ['-a', 'Barnacles'], {
        detached: true,
        stdio: 'ignore',
      }).unref();
    } else if (process.platform === 'win32') {
      // Windows: Try to launch via Start menu or AppData path
      const appName = 'Barnacles';
      spawn('cmd', ['/c', 'start', '', appName], {
        detached: true,
        stdio: 'ignore',
        shell: true,
      }).unref();
    } else {
      // Linux: Try common application launcher commands
      // Try xdg-open first (most universal), fall back to direct executable
      spawn('xdg-open', ['barnacles.desktop'], {
        detached: true,
        stdio: 'ignore',
      }).unref();
    }
  }

  /**
   * Find a project by name (case-insensitive, matching or containing the query)
   * and focus the Barnacles app window on it.
   */
  private async openProject(query: string): Promise<void> {
    log.step(`Looking up project "${query}"...`);

    let projects: ProjectWithDetails[];
    try {
      projects = await apiClient.get<ProjectWithDetails[]>(API_ROUTES.PROJECTS);
    } catch (error) {
      log.error('Failed to connect to the Barnacles backend.');
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
      return;
    }

    const normalizedQuery = query.toLowerCase();
    const project =
      projects.find(p => p.name.toLowerCase() === normalizedQuery) ??
      projects.find(p => p.name.toLowerCase().includes(normalizedQuery));

    if (!project) {
      log.error(`No project found matching "${query}".`);
      process.exit(1);
      return;
    }

    try {
      await apiClient.post(API_ROUTES.SYSTEM_FOCUS_PROJECT, {
        path: `/projects/${project.id}/overview`,
      });
      log.success(`Opened ${project.name} in Barnacles.`);
    } catch (error) {
      log.error('Failed to focus the Barnacles window.');
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }
}
