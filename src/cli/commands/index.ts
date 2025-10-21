import { statusCommand } from './status.js';
import { helpCommand } from './help.js';
import { versionCommand } from './version.js';
import { openCommand } from './open.js';

export interface Command {
  name: string;
  description: string;
  aliases?: string[];
  execute: (_flags: Record<string, string | boolean>) => Promise<void>;
}

export const commands: Command[] = [
  {
    name: 'open',
    description: 'Open the Barnacles application',
    aliases: ['o'],
    execute: openCommand,
  },
  {
    name: 'status',
    description: 'Check the status of Barnacles',
    execute: statusCommand,
  },
  {
    name: 'version',
    description: 'Display the current version',
    execute: versionCommand,
  },
  {
    name: 'help',
    description: 'Display help information',
    execute: helpCommand,
  },
];

export async function executeCommand(
  commandName: string | null,
  flags: Record<string, string | boolean>
): Promise<void> {
  // If no command or help flag, show help
  if (!commandName || commandName === 'help' || flags.help || flags.h) {
    await helpCommand(flags);
    return;
  }

  // Find command by name or alias
  const command = commands.find(
    cmd => cmd.name === commandName || cmd.aliases?.includes(commandName)
  );

  if (!command) {
    console.error(`Unknown command: ${commandName}`);
    console.log('Run "barnacles help" to see available commands.');
    process.exit(1);
  }

  await command.execute(flags);
}
