import { compactLogo } from '../utils/branding.js';
import {
  autocomplete,
  confirm,
  intro,
  isCancel,
  log,
  note,
  outro,
  spinner,
  text,
} from '@clack/prompts';
import { Command } from '../core/Command.js';
import pc from 'picocolors';
import type { Alias } from '../../shared/types/api';
import { apiClient } from '../utils/api-client.js';

/**
 * Command to list and display terminal aliases
 */
export class AliasesCommand extends Command {
  readonly name = 'aliases';
  readonly description = 'List all terminal aliases';
  readonly aliases = ['a'];
  readonly showIntro = false;
  readonly helpText =
    'Interactive menu for managing terminal aliases. Run without arguments to see options. ' +
    'Direct commands: "list" to show table, "add [name] [command]" to create, "remove [name]" to delete, "manage" for interactive search & remove.';
  readonly examples = [
    'barnacles aliases',
    'barnacles aliases list',
    'barnacles aliases manage',
    'barnacles aliases add gs "git status"',
    'barnacles aliases remove gs',
    'barnacles a',
    'barnacles aliases --help',
  ];

  async execute(
    _flags: Record<string, string | boolean>,
    positional: string[] = []
  ): Promise<void> {
    const subcommand = positional[0];

    // Handle direct subcommands
    if (subcommand === 'add') {
      await this.handleAdd(positional.slice(1));
      return;
    }

    if (subcommand === 'remove' || subcommand === 'rm') {
      await this.handleRemove(positional.slice(1));
      return;
    }

    if (subcommand === 'list') {
      await this.listAliases();
      return;
    }

    if (subcommand === 'manage') {
      await this.manageAliases();
      return;
    }

    // Default: show interactive menu
    await this.showMenu();
  }

  /**
   * Get shell reload instruction message
   */
  private async getReloadMessage(): Promise<string> {
    const shellInfo = await apiClient.get<{ path: string; shell: string; profilePaths: string[] }>(
      '/api/aliases/config-path'
    );
    let reloadCommand = 'source ~/.bashrc';

    if (shellInfo.shell === 'zsh') {
      reloadCommand = 'source ~/.zshrc';
    } else if (shellInfo.shell === 'fish') {
      reloadCommand = 'source ~/.config/fish/config.fish';
    }

    return pc.dim(`Note: Run \`${reloadCommand}\` or restart your terminal to apply changes.`);
  }

  /**
   * Show interactive menu
   */
  private async showMenu(): Promise<void> {
    intro(`${compactLogo} Terminal Aliases`);

    const action = await autocomplete({
      message: 'What would you like to do?',
      options: [
        { value: 'list', label: 'List all aliases' },
        { value: 'manage', label: 'Manage aliases (search & remove)' },
        { value: 'add', label: 'Add new alias' },
        { value: 'help', label: 'Show help & usage examples' },
      ],
    });

    if (isCancel(action)) {
      outro('Cancelled');
      process.exit(0);
    }

    // Execute the selected action
    switch (action) {
      case 'list':
        await this.listAliases();
        break;
      case 'manage':
        await this.manageAliases();
        break;
      case 'add':
        await this.handleAdd([]);
        break;
      case 'help':
        await this.showHelp();
        break;
    }
  }

  /**
   * Show help and usage examples
   */
  private async showHelp(): Promise<void> {
    intro(`${compactLogo} Aliases Help`);

    log.info(pc.bold('Description:'));
    log.info(this.helpText);
    log.info('');

    log.info(pc.bold('Usage Examples:'));
    for (const example of this.examples || []) {
      log.info(pc.green(`  $ ${example}`));
    }
    log.info('');

    log.info(pc.bold('Available Subcommands:'));
    log.info(pc.yellow('  list') + '    - Display all aliases in table format');
    log.info(pc.yellow('  manage') + '  - Interactive search and remove');
    log.info(pc.yellow('  add') + '     - Add a new alias');
    log.info(pc.yellow('  remove') + '  - Remove an alias by name');
    log.info(pc.yellow('  help') + '    - Show this help message');

    outro('Run any command to get started');
  }

  /**
   * List all aliases
   */
  private async listAliases(): Promise<void> {
    intro(`${compactLogo} Terminal Aliases`);

    const s = spinner();
    s.start('Loading aliases...');

    try {
      // Fetch all aliases from database using alias-service
      const allAliases = await apiClient.get<Alias[]>('/api/aliases');

      s.stop(`Found ${allAliases.length} alias${allAliases.length === 1 ? '' : 'es'}`);

      if (allAliases.length === 0) {
        log.warn('No aliases configured yet.');
        outro(
          pc.dim(
            'Tip: Open Barnacles app and go to Aliases to create your first alias, or run `barnacles open`'
          )
        );
        return;
      }

      // Group aliases by category
      const categorized = allAliases.reduce(
        (acc, alias) => {
          const category = alias.category || 'custom';
          if (!acc[category]) {
            acc[category] = [];
          }
          acc[category].push(alias);
          return acc;
        },
        {} as Record<string, typeof allAliases>
      );

      // Category display names and order
      const categoryOrder = ['git', 'docker', 'system', 'custom'];
      const categoryLabels: Record<string, string> = {
        git: 'Git',
        docker: 'Docker',
        system: 'System',
        custom: 'Custom',
      };

      // Display each category in table format
      for (const category of categoryOrder) {
        const categoryAliases = categorized[category];
        if (!categoryAliases || categoryAliases.length === 0) continue;

        // Build table for this category
        const table = this.formatAliasTable(categoryAliases);
        note(table, pc.cyan(pc.bold(`${categoryLabels[category]} Aliases`)));
      }

      log.info('');
      outro(pc.dim('Tip: Use "barnacles aliases add/remove" to manage aliases'));
    } catch (error) {
      s.stop('Failed to load aliases');
      log.error('Error fetching aliases from database');
      if (error instanceof Error) {
        log.error(error.message);
        console.error('Full error:', error);
      }
      process.exit(1);
    }
  }

  /**
   * Handle adding an alias
   */
  private async handleAdd(args: string[]): Promise<void> {
    intro(`${compactLogo} Add Alias`);

    let name = args[0];
    let command = args[1];
    let description: string | undefined;

    // Interactive mode if name not provided
    if (!name) {
      const nameInput = await text({
        message: 'Enter alias name:',
        placeholder: 'gs',
        validate: value => {
          if (!value) return 'Alias name is required';
          if (!/^[a-zA-Z0-9_-]+$/.test(value))
            return 'Invalid alias name (alphanumeric, dash, underscore only)';
        },
      });

      if (isCancel(nameInput)) {
        outro('Cancelled');
        process.exit(0);
      }

      name = nameInput as string;
    } else if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      log.error(`Invalid alias name: ${name}`);
      process.exit(1);
    }

    // Interactive mode for command if not provided
    if (!command) {
      const commandInput = await text({
        message: 'Enter command:',
        placeholder: 'git status',
        validate: value => {
          if (!value) return 'Command is required';
        },
      });

      if (isCancel(commandInput)) {
        outro('Cancelled');
        process.exit(0);
      }

      command = commandInput as string;

      // Interactive mode for description (optional) - only in full interactive mode
      const descriptionInput = await text({
        message: 'Enter description (optional):',
        placeholder: 'Show git status',
      });

      if (isCancel(descriptionInput)) {
        outro('Cancelled');
        process.exit(0);
      }

      description = (descriptionInput as string) || undefined;
    }

    // Interactive mode for showCommand (optional) - only in full interactive mode
    let showCommand = true; // default to true
    if (!args[0]) {
      // Only ask in full interactive mode (when no args provided)
      const showCommandInput = await confirm({
        message: 'Echo the command before executing? (displays what the alias runs)',
        initialValue: true,
      });

      if (isCancel(showCommandInput)) {
        outro('Cancelled');
        process.exit(0);
      }

      showCommand = showCommandInput as boolean;
    }

    const s = spinner();
    s.start('Checking for existing alias...');

    try {
      // Check if alias already exists
      const allAliases = await apiClient.get<Alias[]>('/api/aliases');
      const existing = allAliases.find(a => a.name === name);

      if (existing) {
        s.stop('Alias already exists');
        log.warn(`Alias "${name}" already exists with command: ${existing.command}`);

        const shouldUpdate = await confirm({
          message: `Update alias "${name}"?`,
        });

        if (isCancel(shouldUpdate) || !shouldUpdate) {
          outro('Cancelled');
          process.exit(0);
        }

        // Update existing alias
        s.start('Updating alias...');
        await apiClient.put(`/api/aliases/${existing.id}`, {
          command,
          description,
          showCommand,
        });

        s.stop('Alias updated successfully');
      } else {
        // Get max order for new alias
        const maxOrder = allAliases.length > 0 ? Math.max(...allAliases.map(a => a.order)) : 0;

        // Insert new alias
        s.message('Adding alias...');
        await apiClient.post('/api/aliases', {
          name,
          command,
          description: description || null,
          color: null,
          showCommand,
          category: 'custom',
          order: maxOrder + 1,
        });

        s.stop('Alias added successfully');
      }

      // Sync aliases to shell
      s.start('Syncing aliases to shell...');
      await apiClient.post('/api/aliases/sync');
      s.stop('Aliases synced to shell');

      log.success(`${pc.green(name)} → ${pc.yellow(command)}`);
      if (description) {
        log.info(pc.dim(description));
      }

      const reloadMsg = await this.getReloadMessage();
      outro(`Done! Alias has been saved and synced.\n${reloadMsg}`);
    } catch (error) {
      s.stop('Failed to add alias');
      log.error('Error updating database');
      if (error instanceof Error) {
        log.error(error.message);
      }
      process.exit(1);
    }
  }

  /**
   * Manage aliases with interactive search
   */
  private async manageAliases(): Promise<void> {
    intro(`${compactLogo} Manage Aliases`);

    const s = spinner();
    s.start('Loading aliases...');

    try {
      // Fetch all aliases using alias-service
      const allAliases = await apiClient.get<Alias[]>('/api/aliases');
      s.stop(`Found ${allAliases.length} alias${allAliases.length === 1 ? '' : 'es'}`);

      if (allAliases.length === 0) {
        log.warn('No aliases to manage');
        outro('Tip: Use "barnacles aliases add" to create aliases');
        return;
      }

      // Interactive selection with search
      const selection = await autocomplete({
        message: 'Select an alias to remove (type to search):',
        options: allAliases.map(a => ({
          value: a.name,
          label: `${pc.yellow(a.name)} - ${pc.green(a.command)}${a.description ? pc.dim(` (${a.description})`) : ''}`,
        })),
      });

      if (isCancel(selection)) {
        outro('Cancelled');
        process.exit(0);
      }

      const name = selection as string;
      const aliasToRemove = allAliases.find(a => a.name === name);

      if (!aliasToRemove) {
        log.error('Alias not found');
        process.exit(1);
      }

      // Confirm removal
      const shouldRemove = await confirm({
        message: `Remove alias "${pc.yellow(name)}" (${pc.green(aliasToRemove.command)})?`,
      });

      if (isCancel(shouldRemove) || !shouldRemove) {
        outro('Cancelled');
        process.exit(0);
      }

      s.start('Removing alias...');

      // Remove the alias
      await apiClient.delete(`/api/aliases/${aliasToRemove.id}`);

      // Sync aliases to shell
      s.message('Syncing aliases to shell...');
      await apiClient.post('/api/aliases/sync');

      s.stop('Alias removed and synced successfully');
      log.success(`Removed: ${pc.yellow(name)}`);

      const reloadMsg = await this.getReloadMessage();
      outro(`Done! Alias has been removed and synced.\n${reloadMsg}`);
    } catch (error) {
      s.stop('Failed to manage aliases');
      log.error('Error accessing database');
      if (error instanceof Error) {
        log.error(error.message);
      }
      process.exit(1);
    }
  }

  /**
   * Handle removing an alias
   */
  private async handleRemove(args: string[]): Promise<void> {
    intro(`${compactLogo} Remove Alias`);

    const s = spinner();
    s.start('Loading aliases...');

    try {
      // Fetch all aliases using alias-service
      const allAliases = await apiClient.get<Alias[]>('/api/aliases');
      s.stop(`Found ${allAliases.length} alias${allAliases.length === 1 ? '' : 'es'}`);

      let name = args[0];

      // Interactive mode if name not provided
      if (!name) {
        if (allAliases.length === 0) {
          log.warn('No aliases to remove');
          outro('Done');
          return;
        }

        const selection = await autocomplete({
          message: 'Select an alias to remove:',
          options: allAliases.map(a => ({
            value: a.name,
            label: `${a.name} - ${a.command}${a.description ? ` (${a.description})` : ''}`,
          })),
        });

        if (isCancel(selection)) {
          outro('Cancelled');
          process.exit(0);
        }

        name = selection as string;
      }

      // Find the alias
      const aliasToRemove = allAliases.find(a => a.name === name);
      if (!aliasToRemove) {
        log.error(`Alias "${name}" not found`);
        process.exit(1);
      }

      // Confirm removal
      const shouldRemove = await confirm({
        message: `Remove alias "${pc.yellow(name)}" (${pc.green(aliasToRemove.command)})?`,
      });

      if (isCancel(shouldRemove) || !shouldRemove) {
        outro('Cancelled');
        process.exit(0);
      }

      s.start('Removing alias...');

      // Remove the alias
      await apiClient.delete(`/api/aliases/${aliasToRemove.id}`);

      // Sync aliases to shell
      s.message('Syncing aliases to shell...');
      await apiClient.post('/api/aliases/sync');

      s.stop('Alias removed and synced successfully');
      log.success(`Removed: ${pc.yellow(name)}`);

      const reloadMsg = await this.getReloadMessage();
      outro(`Done! Alias has been removed and synced.\n${reloadMsg}`);
    } catch (error) {
      s.stop('Failed to remove alias');
      log.error('Error updating database');
      if (error instanceof Error) {
        log.error(error.message);
      }
      process.exit(1);
    }
  }

  /**
   * Format aliases as a table
   */
  private formatAliasTable(aliases: Alias[]): string {
    // Calculate column widths
    const nameWidth = Math.max(4, ...aliases.map(a => a.name.length));
    const commandWidth = Math.max(7, ...aliases.map(a => a.command.length));

    // Build header
    const header = `${pc.bold('Name'.padEnd(nameWidth))}  ${pc.bold('Command'.padEnd(commandWidth))}  ${pc.bold('Description')}`;
    const separator = `${'─'.repeat(nameWidth)}  ${'─'.repeat(commandWidth)}  ${'─'.repeat(20)}`;

    // Build rows
    const rows = aliases.map(alias => {
      const name = pc.green(alias.name.padEnd(nameWidth));
      const command = pc.yellow(alias.command.padEnd(commandWidth));
      const description = pc.dim(alias.description || '');
      return `${name}  ${command}  ${description}`;
    });

    return [header, separator, ...rows].join('\n');
  }
}
