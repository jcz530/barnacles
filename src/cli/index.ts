#!/usr/bin/env node

import { intro, outro } from '@clack/prompts';
import { parseArgs } from './utils/arg-parser.js';
import { executeCommand, registry } from './commands';
import { compactLogo, getTitle } from './utils/branding';

async function main() {
  const args = process.argv.slice(2);
  const { command, flags } = parseArgs(args);

  // Handle version flag globally
  if (flags.version || flags.v) {
    const versionCommand = registry.find('version');
    if (versionCommand) {
      await versionCommand.run(flags);
    }
    return;
  }

  // Show intro only for commands that need it
  let shouldShowIntro = false;
  if (command) {
    const commandObj = registry.find(command);
    shouldShowIntro = commandObj?.showIntro ?? false;
  }

  if (shouldShowIntro) {
    intro(`${compactLogo} ${getTitle()}`);
  }

  try {
    await executeCommand(command, flags);

    if (shouldShowIntro) {
      outro('Done!');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error(`Error: ${errorMessage}`);
    process.exit(1);
  }
}

main().then();
