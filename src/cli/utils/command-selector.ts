import { autocomplete } from '@clack/prompts';
import type { CommandRegistry } from '../core/CommandRegistry.js';

/**
 * Show an interactive autocomplete selector for available commands
 * @param registry - The command registry containing all available commands
 * @returns The selected command name, or null if cancelled
 */
export async function selectCommand(registry: CommandRegistry): Promise<string | symbol> {
  const commands = registry.all();

  // Filter out help command as it's shown by default when no command is provided
  const filteredCommands = commands.filter(cmd => cmd.name !== 'help' && cmd.name !== 'version');

  const options = filteredCommands.map(cmd => ({
    value: cmd.name,
    label: cmd.name,
    hint: cmd.description,
  }));

  // Add a help option at the end
  options.push({
    value: 'help',
    label: 'help',
    hint: 'Show help information',
  });

  return await autocomplete({
    message: 'Select a command:',
    options,
  });
}
