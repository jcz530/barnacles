import { log } from '@clack/prompts';
import type { ProjectAction } from './types.js';
import type { ProjectWithDetails } from '../../shared/types/api.js';
import { copyToClipboard } from '../../shared/utils/platform.js';

/**
 * Action to copy project path to clipboard
 */
export class CopyPathAction implements ProjectAction {
  readonly id = 'path';
  readonly label = 'Copy Path';
  readonly hint = 'Copy project path to clipboard';

  async execute(project: ProjectWithDetails): Promise<void> {
    try {
      await copyToClipboard(project.path);
      log.success(`Copied path to clipboard: ${project.path}`);
    } catch (error) {
      log.error('Failed to copy path to clipboard');
      console.error(error);
    }
  }
}
