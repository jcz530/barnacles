import { CommandRegistry } from '../core/CommandRegistry.js';
import { OpenCommand } from './open.js';
import { StatusCommand } from './status.js';
import { HelpCommand } from './help.js';
import { VersionCommand } from './version.js';

/**
 * Global command registry
 */
export const registry = new CommandRegistry();

/**
 * Register all commands
 */
function registerCommands(): void {
  registry.register(new OpenCommand());
  registry.register(new VersionCommand());
  registry.register(new StatusCommand());
  registry.register(new HelpCommand());
}

// Initialize commands
registerCommands();

/**
 * Execute a command by name
 */
export async function executeCommand(
  commandName: string | null,
  flags: Record<string, string | boolean>
): Promise<void> {
  // If no command or help flag, show help
  if (!commandName || commandName === 'help' || flags.help || flags.h) {
    const helpCommand = registry.find('help');
    if (helpCommand) {
      await helpCommand.run(flags);
    }
    return;
  }

  // Find command by name or alias
  const command = registry.find(commandName);

  if (!command) {
    console.error(`Unknown command: ${commandName}`);
    console.log('Run "barnacles help" to see available commands.');
    process.exit(1);
  }

  await command.run(flags);
}
