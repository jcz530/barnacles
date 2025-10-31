import { compactLogo } from '../utils/branding.js';
import { autocomplete, intro, isCancel, log, outro } from '@clack/prompts';
import { Command } from '../core/Command.js';
import pc from 'picocolors';
import { cliUtilityRegistry, registerCliUtilities } from '../utilities/registry.js';

/**
 * Command to access various developer utilities
 */
export class UtilitiesCommand extends Command {
  readonly name = 'utilities';
  readonly description = 'Access developer utilities and tools';
  readonly aliases = ['util', 'u'];
  readonly showIntro = false;
  readonly helpText =
    'Interactive menu for developer utilities. Run without arguments to see available utilities. ' +
    'Direct commands: "utilities <utility-name> [args]" to run a specific utility.';
  readonly examples = [
    'barnacles utilities',
    'barnacles utilities color-converter "#3b82f6"',
    'barnacles util color-converter "rgb(59, 130, 246)"',
    'barnacles u',
  ];

  async beforeExecute(): Promise<void> {
    // Register all CLI utilities
    registerCliUtilities();
    // Give registry time to load async modules
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  async execute(
    _flags: Record<string, string | boolean>,
    positional: string[] = []
  ): Promise<void> {
    const utilityId = positional[0];

    // If a utility ID is provided, try to execute it directly
    if (utilityId) {
      await this.executeUtility(utilityId, positional.slice(1));
      return;
    }

    // Otherwise, show interactive menu
    await this.showMenu();
  }

  /**
   * Execute a specific utility
   */
  private async executeUtility(utilityId: string, args: string[]): Promise<void> {
    const utility = cliUtilityRegistry.get(utilityId);

    if (!utility) {
      log.error(`Unknown utility: ${utilityId}`);
      log.info('Run "barnacles utilities" to see available utilities');
      return;
    }

    try {
      await utility.handler.execute(args, {});
    } catch (error) {
      log.error(`Error executing utility: ${error}`);
    }
  }

  /**
   * Show interactive menu to select a utility
   */
  private async showMenu(): Promise<void> {
    intro(`${compactLogo} Developer Utilities`);

    const utilities = cliUtilityRegistry.getAll();

    if (utilities.length === 0) {
      log.warn('No utilities available');
      outro('Check back later for new utilities');
      return;
    }

    const selectedUtility = await autocomplete({
      message: 'Select a utility:',
      options: utilities.map(util => ({
        value: util.id,
        label: util.name,
        hint: util.description,
      })),
    });

    if (isCancel(selectedUtility)) {
      outro('Cancelled');
      return;
    }

    const utility = cliUtilityRegistry.get(String(selectedUtility));

    if (!utility) {
      outro('Utility not found');
      return;
    }

    // Clear the screen a bit for a clean utility execution
    console.log('');

    // Execute the utility in interactive mode (no arguments)
    try {
      await utility.handler.execute([], {});
    } catch (error) {
      log.error(`Error executing utility: ${error}`);
      outro('Utility execution failed');
    }
  }
}
