import { log } from '@clack/prompts';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { ProjectAction } from './types.js';
import type { ProjectWithDetails } from '../../backend/services/project/index.js';

const execAsync = promisify(exec);

/**
 * Action to copy project path to clipboard
 */
export class CopyPathAction implements ProjectAction {
  readonly id = 'path';
  readonly label = 'Copy Path';
  readonly hint = 'Copy project path to clipboard';

  async execute(project: ProjectWithDetails): Promise<void> {
    try {
      // Use pbcopy on macOS to copy to clipboard
      // printf is more reliable than echo -n for avoiding trailing newlines
      await execAsync(`printf '%s' "${project.path}" | pbcopy`);
      log.success(`Copied path to clipboard: ${project.path}`);
    } catch (error) {
      log.error('Failed to copy path to clipboard');
      console.error(error);
    }
  }
}
