import { commands } from './index.js';
import { printHeader } from '../utils/branding.js';

export async function helpCommand(_flags: Record<string, string | boolean>): Promise<void> {
  printHeader();

  console.log('Usage: barnacles <command> [options]\n');
  console.log('Available commands:\n');

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
