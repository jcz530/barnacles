import { compactLogo } from '../utils/branding.js';
import { intro, outro, spinner, log, note } from '@clack/prompts';
import { Command } from '../core/Command.js';
import { db, aliases } from '../../shared/database';
import { asc } from 'drizzle-orm';
import pc from 'picocolors';
import type { Alias } from '../../shared/types/api';

/**
 * Command to list and display terminal aliases
 */
export class AliasesCommand extends Command {
  readonly name = 'aliases';
  readonly description = 'List all terminal aliases';
  readonly aliases = ['a'];
  readonly showIntro = false;
  readonly helpText =
    'Displays all configured terminal aliases with their commands and descriptions.';
  readonly examples = ['barnacles aliases', 'barnacles a', 'barnacles aliases --help'];

  async execute(): Promise<void> {
    intro(`${compactLogo} Terminal Aliases`);

    const s = spinner();
    s.start('Loading aliases...');

    try {
      // Fetch all aliases from database, ordered by name
      const allAliases = await db.select().from(aliases).orderBy(asc(aliases.name));

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
      outro(
        pc.dim('Tip: Manage your aliases in the Barnacles app or run `barnacles open` to launch it')
      );
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
