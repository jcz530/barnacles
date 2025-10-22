import { log, select } from '@clack/prompts';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { ProjectAction } from './types.js';
import type { ProjectWithDetails } from '../../backend/services/project-service.js';
import { terminalDetectorService } from '../../backend/services/terminal-detector-service.js';
import { detectCurrentTerminal, getTerminalName } from '../utils/terminal-detector.js';

const execAsync = promisify(exec);

/**
 * Action to open a new terminal tab/window at the project path
 *
 * Detects the current terminal and opens a new tab in the same terminal application.
 */
export class OpenInTerminalAction implements ProjectAction {
  readonly id = 'cd';
  readonly label = 'Open in New Terminal Tab';
  readonly hint = 'Open a new terminal tab at this project directory';

  async execute(project: ProjectWithDetails): Promise<void> {
    const currentTerminal = detectCurrentTerminal();

    if (!currentTerminal) {
      await this.handleUnknownTerminal(project);
      return;
    }

    const terminalName = getTerminalName(currentTerminal);
    log.step(`Opening new ${terminalName} tab at ${project.name}...`);

    try {
      await terminalDetectorService.openTerminalAtPath(currentTerminal, project.path);
      log.success(`Opened new ${terminalName} tab at ${project.path}`);
    } catch (error) {
      log.error(
        `Failed to open terminal: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      await this.handleUnknownTerminal(project);
    }
  }

  /**
   * Handles the case when terminal detection fails
   * Offers to copy the cd command to clipboard
   */
  private async handleUnknownTerminal(project: ProjectWithDetails): Promise<void> {
    const cdCommand = `cd "${project.path}"`;

    const choice = await select({
      message: 'Could not detect terminal. What would you like to do?',
      options: [
        {
          value: 'copy',
          label: 'Copy cd command to clipboard',
          hint: 'Copy the command so you can paste it',
        },
        {
          value: 'show',
          label: 'Show cd command',
          hint: 'Display the command to copy manually',
        },
      ],
    });

    if (choice === 'copy') {
      try {
        await execAsync(`printf '%s' "${cdCommand}" | pbcopy`);
        log.success('Copied to clipboard! Paste it in your terminal to change directory.');
      } catch {
        log.error('Failed to copy to clipboard');
        log.info('Run this command manually:');
        console.log(`\n${cdCommand}\n`);
      }
    } else {
      log.info('Run this command to change directory:');
      console.log(`\n${cdCommand}\n`);
    }
  }
}
