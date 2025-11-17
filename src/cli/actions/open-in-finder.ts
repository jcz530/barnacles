import { log } from '@clack/prompts';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { ProjectAction } from './types.js';
import type { ProjectWithDetails } from '../../shared/types/api.js';

const execAsync = promisify(exec);

/**
 * Action to open project in Finder (macOS)
 */
export class OpenInFinderAction implements ProjectAction {
  readonly id = 'finder';
  readonly label = 'Open in Finder';
  readonly hint = 'Open project directory in Finder';

  async execute(project: ProjectWithDetails): Promise<void> {
    try {
      // Use 'open' command on macOS to open the directory in Finder
      await execAsync(`open "${project.path}"`);
      log.success(`Opened ${project.name} in Finder`);
    } catch (error) {
      log.error('Failed to open in Finder');
      console.error(error);
    }
  }
}
