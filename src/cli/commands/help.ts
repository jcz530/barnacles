import { registry } from './index.js';
import { printHeader } from '../utils/branding.js';
import { Command } from '../core/Command.js';

/**
 * Command to display help information
 */
export class HelpCommand extends Command {
  readonly name = 'help';
  readonly description = 'Display help information';
  readonly showIntro = false;

  async execute(_flags: Record<string, string | boolean>): Promise<void> {
    printHeader();

    console.log('Usage: barnacles <command> [options]\n');
    console.log('Available commands:\n');

    const commands = registry.all();
    const commandsWithAliases = commands.map(cmd => ({
      ...cmd,
      displayName: cmd.aliases?.length ? `${cmd.name}, ${cmd.aliases.join(', ')}` : cmd.name,
    }));

    const maxCommandLength = Math.max(...commandsWithAliases.map(cmd => cmd.displayName.length));

    commandsWithAliases.forEach(cmd => {
      const padding = ' '.repeat(maxCommandLength - cmd.displayName.length + 2);
      console.log(`  ${cmd.displayName}${padding}${cmd.description}`);
    });

    console.log('\nOptions:\n');
    console.log('  --help, -h  Show help information');
    console.log('  --version, -v  Show version information');
    console.log('');
  }
}
