#!/usr/bin/env node

import { intro, isCancel, outro } from '@clack/prompts';
import { parseArgs } from './utils/arg-parser.js';
import { executeCommand, registry } from './commands';
import { compactLogo, getTitle, printHeader } from './utils/branding';
import { selectCommand } from './utils/command-selector.js';

async function main() {
  const args = process.argv.slice(2);
  const { command, flags, positional } = parseArgs(args);

  // Handle version flag globally
  if (flags.version || flags.v) {
    const versionCommand = registry.find('version');
    if (versionCommand) {
      await versionCommand.run(flags);
    }
    return;
  }

  let selectedCommand = command;

  // If no command provided, show interactive selector
  if (!selectedCommand) {
    printHeader();
    const result = await selectCommand(registry);

    if (isCancel(result)) {
      outro('Cancelled');
      process.exit(0);
    }

    selectedCommand = String(result);
  }

  // Show intro only for commands that need it
  let shouldShowIntro = false;
  if (selectedCommand) {
    const commandObj = registry.find(selectedCommand);
    shouldShowIntro = commandObj?.showIntro ?? false;
  }

  if (shouldShowIntro && command) {
    // Only show intro if command was provided as argument (not selected interactively)
    intro(`${compactLogo} ${getTitle()}`);
  }

  try {
    await executeCommand(selectedCommand, flags, positional);

    if (shouldShowIntro || !command) {
      outro('Done!');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    console.error(`Error: ${errorMessage}`);
    process.exit(1);
  }
}

main().then();
