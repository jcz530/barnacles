import { log } from '@clack/prompts';
import type { ProjectAction } from './types.js';
import type { ProjectWithDetails } from '../../shared/types/api.js';
import { openInFileManager, isWindows, isMac } from '../../shared/utils/platform.js';

/**
 * Get the file manager name for the current platform
 */
function getFileManagerName(): string {
  if (isMac) return 'Finder';
  if (isWindows) return 'Explorer';
  return 'file manager';
}

/**
 * Action to open project in the system file manager
 */
export class OpenInFinderAction implements ProjectAction {
  readonly id = 'finder';
  readonly label = `Open in ${getFileManagerName()}`;
  readonly hint = `Open project directory in ${getFileManagerName()}`;

  async execute(project: ProjectWithDetails): Promise<void> {
    const fileManagerName = getFileManagerName();
    try {
      await openInFileManager(project.path);
      log.success(`Opened ${project.name} in ${fileManagerName}`);
    } catch (error) {
      log.error(`Failed to open in ${fileManagerName}`);
      console.error(error);
    }
  }
}
