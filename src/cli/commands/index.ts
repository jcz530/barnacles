import { CommandRegistry } from '../core/CommandRegistry.js';
import { OpenCommand } from './open.js';
import { StatusCommand } from './status.js';
import { HelpCommand } from './help.js';
import { VersionCommand } from './version.js';
import { ProjectsCommand } from './projects.js';
import { AliasesCommand } from './aliases.js';
import { HostsCommand } from './hosts.js';
import { displayCommandHelp } from '../utils/command-help.js';
import { compactLogo, getTitle } from '../utils/branding';
import { intro, log, outro } from '@clack/prompts';

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
  registry.register(new ProjectsCommand());
  registry.register(new AliasesCommand());
  registry.register(new HostsCommand());
  registry.register(new HelpCommand());
}

// Initialize commands
registerCommands();

/**
 * Execute a command by name
 */
export async function executeCommand(
  commandName: string | null,
  flags: Record<string, string | boolean>,
  positional: string[] = []
): Promise<void> {
  // If no command or global help flag, show general help
  if (!commandName || commandName === 'help') {
    const helpCommand = registry.find('help');
    if (helpCommand) {
      await helpCommand.run(flags, positional);
    }
    return;
  }

  // Find command by name or alias
  const command = registry.find(commandName);

  if (!command) {
    intro(`${compactLogo} ${getTitle()}`);
    log.error(`Unknown command: ${commandName}`);
    outro('Run "barnacles help" to see available commands.');
    process.exit(1);
  }

  // If command-specific help flag, show command help
  if (flags.help || flags.h) {
    displayCommandHelp(command);
    return;
  }

  await command.run(flags, positional);
}
