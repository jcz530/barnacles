import type { Command } from '../core/Command.js';
import pc from './colors.js';

/**
 * Displays detailed help for a specific command
 */
export function displayCommandHelp(command: Command): void {
  console.log('');
  console.log(pc.bold(`${command.name}`) + ` - ${command.description}`);
  console.log('');

  // Usage
  console.log(pc.bold('Usage:'));
  const aliases = command.aliases?.length ? ` (${command.aliases.join(', ')})` : '';
  console.log(`  barnacles ${command.name}${aliases} [options]`);
  console.log('');

  // Detailed description
  if (command.helpText) {
    console.log(pc.bold('Description:'));
    console.log(`  ${command.helpText}`);
    console.log('');
  }

  // Options
  if (command.options && command.options.length > 0) {
    console.log(pc.bold('Options:'));
    const maxFlagLength = Math.max(...command.options.map(opt => opt.flag.length));
    command.options.forEach(opt => {
      const padding = ' '.repeat(maxFlagLength - opt.flag.length + 2);
      console.log(`  ${opt.flag}${padding}${opt.description}`);
    });
    console.log('');
  }

  // Common options
  console.log(pc.bold('Common Options:'));
  console.log('  --help, -h     Show this help message');
  console.log('  --version, -v  Show version information');
  console.log('');

  // Examples
  if (command.examples && command.examples.length > 0) {
    console.log(pc.bold('Examples:'));
    command.examples.forEach(example => {
      console.log(`  ${pc.dim('$')} ${example}`);
    });
    console.log('');
  }
}
