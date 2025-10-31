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
import { promises as fs } from 'fs';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface HostEntry {
  id: string;
  ip: string;
  hostname: string;
}

/**
 * Command to list and display /etc/hosts entries
 */
export class HostsCommand extends Command {
  readonly name = 'hosts';
  readonly description = 'List all /etc/hosts entries';
  readonly aliases = ['h'];
  readonly showIntro = false;
  readonly helpText =
    'Interactive menu for managing /etc/hosts entries. Run without arguments to see options. ' +
    'Direct commands: "list" to show table, "add [hostname] [ip]" to create, "remove [hostname]" to delete, "manage" for interactive search · edit · remove.';
  readonly examples = [
    'barnacles hosts',
    'barnacles hosts list',
    'barnacles hosts manage',
    'barnacles hosts add myhost.test',
    'barnacles hosts add myhost.test 192.168.1.1',
    'barnacles hosts remove myhost.test',
    'barnacles h',
    'barnacles hosts --help',
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
      await this.listHosts();
      return;
    }

    if (subcommand === 'manage') {
      await this.manageHosts();
      return;
    }

    // Default: show interactive menu
    await this.showMenu();
  }

  /**
   * Show interactive menu
   */
  private async showMenu(): Promise<void> {
    intro(`${compactLogo} /etc/hosts Manager`);

    const action = await autocomplete({
      message: 'What would you like to do?',
      options: [
        { value: 'list', label: 'List all hosts' },
        { value: 'manage', label: 'Manage hosts (search · edit · remove)' },
        { value: 'add', label: 'Add new host' },
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
        await this.listHosts();
        break;
      case 'manage':
        await this.manageHosts();
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
    intro(`${compactLogo} Hosts Help`);

    log.info(pc.bold('Description:'));
    log.info(this.helpText);
    log.info('');

    log.info(pc.bold('Usage Examples:'));
    for (const example of this.examples || []) {
      log.info(pc.green(`  $ ${example}`));
    }
    log.info('');

    log.info(pc.bold('Available Subcommands:'));
    log.info(pc.yellow('  list') + '    - Display all hosts in table format');
    log.info(pc.yellow('  manage') + '  - Interactive search and remove');
    log.info(pc.yellow('  add') + '     - Add a new host entry');
    log.info(pc.yellow('  remove') + '  - Remove a host entry by hostname');
    log.info(pc.yellow('  help') + '    - Show this help message');

    outro('Run any command to get started');
  }

  /**
   * Get the hosts file path based on OS
   */
  private getHostsPath(): string {
    return os.platform() === 'win32' ? 'C:\\Windows\\System32\\drivers\\etc\\hosts' : '/etc/hosts';
  }

  /**
   * List all hosts entries
   */
  private async listHosts(): Promise<void> {
    intro(`${compactLogo} /etc/hosts Entries`);

    const s = spinner();
    s.start('Loading hosts...');

    try {
      const hosts = await this.readHostsFile();

      s.stop(`Found ${hosts.length} host entr${hosts.length === 1 ? 'y' : 'ies'}`);

      if (hosts.length === 0) {
        log.warn('No host entries found in /etc/hosts.');
        outro(pc.dim('Tip: Use "barnacles hosts add" to add entries'));
        return;
      }

      // Build and display the table
      const table = this.formatHostsTable(hosts);
      note(table, pc.cyan(pc.bold('Host Entries')));

      log.info('');
      outro(pc.dim('Tip: Use "barnacles hosts add/remove" to manage entries'));
    } catch (error) {
      s.stop('Failed to load hosts');
      log.error('Error reading hosts file');
      if (error instanceof Error) {
        log.error(error.message);
        console.error('Full error:', error);
      }
      process.exit(1);
    }
  }

  /**
   * Format hosts as a table
   */
  private formatHostsTable(hosts: HostEntry[]): string {
    // Calculate column widths
    const ipWidth = Math.max(10, ...hosts.map(h => h.ip.length));
    const hostnameWidth = Math.max(8, ...hosts.map(h => h.hostname.length));

    // Build header
    const header = `${pc.bold('IP Address'.padEnd(ipWidth))}  ${pc.bold('Hostname'.padEnd(hostnameWidth))}`;
    const separator = `${'─'.repeat(ipWidth)}  ${'─'.repeat(hostnameWidth)}`;

    // Build rows
    const rows = hosts.map(host => {
      const ip = pc.green(host.ip.padEnd(ipWidth));
      const hostname = pc.yellow(host.hostname.padEnd(hostnameWidth));
      return `${ip}  ${hostname}`;
    });

    return [header, separator, ...rows].join('\n');
  }

  /**
   * Check if a string is a valid IPv4 or IPv6 address
   */
  private isIpAddress(str: string): boolean {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
    return ipv4Regex.test(str) || ipv6Regex.test(str);
  }

  /**
   * Validate hostname format
   */
  private isValidHostname(hostname: string): boolean {
    return /^[a-zA-Z0-9]([a-zA-Z0-9-_.]*[a-zA-Z0-9])?$/.test(hostname);
  }

  /**
   * Read and parse the hosts file
   */
  private async readHostsFile(): Promise<HostEntry[]> {
    const hostsPath = this.getHostsPath();
    const hostsContent = await fs.readFile(hostsPath, 'utf-8');

    const hosts: HostEntry[] = [];
    const lines = hostsContent.split('\n');

    for (const line of lines) {
      // Skip empty lines and comments
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Parse line: IP hostname [aliases...]
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 2) {
        const ip = parts[0];
        // Get all hostnames (skip IP)
        for (let i = 1; i < parts.length; i++) {
          const hostname = parts[i];
          // Skip inline comments
          if (hostname.startsWith('#')) break;

          hosts.push({
            id: `${ip}-${hostname}`,
            ip,
            hostname,
          });
        }
      }
    }

    return hosts;
  }

  /**
   * Write hosts to the hosts file
   */
  private async writeHostsFile(hosts: Array<{ ip: string; hostname: string }>): Promise<void> {
    const hostsPath = this.getHostsPath();
    const customMarker = '# Custom local domains managed by Barnacles';

    // Read existing hosts file to preserve comments and system entries
    const existingContent = await fs.readFile(hostsPath, 'utf-8');
    const lines = existingContent.split('\n');

    // Build new content preserving comments (but skip our custom marker)
    const commentLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      // Keep comments and empty lines, but skip our custom marker to avoid duplicates
      if ((!trimmed || trimmed.startsWith('#')) && trimmed !== customMarker) {
        commentLines.push(line);
      }
    }

    // Build new hosts content
    let newContent = commentLines.join('\n');
    if (newContent && !newContent.endsWith('\n')) {
      newContent += '\n';
    }

    // Add custom hosts section marker
    newContent += `\n${customMarker}\n`;

    // Write each host entry on its own line
    for (const host of hosts) {
      newContent += `${host.ip}\t${host.hostname}\n`;
    }

    // Write to a temporary file first (in /tmp which we have access to)
    const tmpPath = `/tmp/hosts-${Date.now()}.tmp`;
    await fs.writeFile(tmpPath, newContent, 'utf-8');

    // Use sudo to move the temp file to the hosts file location
    if (os.platform() === 'win32') {
      // On Windows, use copy command (may require admin privileges)
      await fs.copyFile(tmpPath, hostsPath);
      await fs.unlink(tmpPath);
    } else {
      // On Unix-like systems, use osascript to prompt for admin password
      try {
        // Use osascript on macOS to get GUI password prompt
        // Escape single quotes in paths and use proper shell escaping
        const escapedTmpPath = tmpPath.replace(/'/g, "'\\''");
        const escapedHostsPath = hostsPath.replace(/'/g, "'\\''");
        const script = `do shell script "mv '${escapedTmpPath}' '${escapedHostsPath}'" with administrator privileges`;

        await execAsync(`osascript -e '${script}'`);
      } catch (error) {
        // Clean up temp file
        try {
          await fs.unlink(tmpPath);
        } catch (unlinkError) {
          // Ignore cleanup errors
        }
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(
          `Failed to update hosts file. ${errorMsg}. Administrator privileges are required.`
        );
      }
    }
  }

  /**
   * Handle adding a host entry
   */
  private async handleAdd(args: string[]): Promise<void> {
    intro(`${compactLogo} Add Host Entry`);

    let hostname = args[0];
    let ip = args[1];

    // If first arg looks like an IP, swap them
    if (hostname && this.isIpAddress(hostname)) {
      [ip, hostname] = [hostname, ip];
    }

    // Interactive mode if hostname not provided
    if (!hostname) {
      const hostnameInput = await text({
        message: 'Enter hostname (e.g., myapp.test):',
        placeholder: 'myapp.test',
        validate: value => {
          if (!value) return 'Hostname is required';
          if (!this.isValidHostname(value)) return 'Invalid hostname format';
        },
      });

      if (isCancel(hostnameInput)) {
        outro('Cancelled');
        process.exit(0);
      }

      hostname = hostnameInput as string;
    } else if (!this.isValidHostname(hostname)) {
      log.error(`Invalid hostname format: ${hostname}`);
      process.exit(1);
    }

    // Interactive mode for IP if not provided
    if (!ip) {
      const ipInput = await text({
        message: 'Enter IP address (default: 127.0.0.1):',
        placeholder: '127.0.0.1',
        defaultValue: '127.0.0.1',
        validate: value => {
          if (value && !this.isIpAddress(value)) return 'Invalid IP address format';
        },
      });

      if (isCancel(ipInput)) {
        outro('Cancelled');
        process.exit(0);
      }

      ip = (ipInput as string) || '127.0.0.1';
    } else if (!this.isIpAddress(ip)) {
      log.error(`Invalid IP address format: ${ip}`);
      process.exit(1);
    }

    const s = spinner();
    s.start('Reading hosts file...');

    try {
      // Read current hosts
      const currentHosts = await this.readHostsFile();

      // Check if hostname already exists
      const existingHost = currentHosts.find(h => h.hostname === hostname);
      if (existingHost) {
        s.stop('Host already exists');
        log.warn(`Host "${hostname}" already exists with IP ${existingHost.ip}`);

        const shouldUpdate = await confirm({
          message: `Update ${hostname} to point to ${ip}?`,
        });

        if (isCancel(shouldUpdate) || !shouldUpdate) {
          outro('Cancelled');
          process.exit(0);
        }

        s.start('Updating host entry...');
      } else {
        s.start('Adding host entry...');
      }

      // Filter out the existing entry (if any) and add the new one
      const updatedHosts = currentHosts
        .filter(h => h.hostname !== hostname)
        .map(h => ({ ip: h.ip, hostname: h.hostname }));

      updatedHosts.push({ ip, hostname });

      // Write to hosts file
      await this.writeHostsFile(updatedHosts);

      s.stop('Host entry added successfully');
      log.success(`Added: ${pc.green(ip)} → ${pc.yellow(hostname)}`);
      outro('Done! Your /etc/hosts file has been updated.');
    } catch (error) {
      s.stop('Failed to add host entry');
      log.error('Error updating hosts file');
      if (error instanceof Error) {
        log.error(error.message);
      }
      process.exit(1);
    }
  }

  /**
   * Manage hosts with interactive search
   */
  private async manageHosts(): Promise<void> {
    intro(`${compactLogo} Manage Hosts`);

    const s = spinner();
    s.start('Loading hosts...');

    try {
      // Read current hosts
      const currentHosts = await this.readHostsFile();
      s.stop(`Found ${currentHosts.length} host entries`);

      if (currentHosts.length === 0) {
        log.warn('No host entries to manage');
        outro('Tip: Use "barnacles hosts add" to create host entries');
        return;
      }

      // Interactive selection with search
      const selection = await autocomplete({
        message: 'Select a host to manage (type to search):',
        options: currentHosts.map(h => ({
          value: h.hostname,
          label: `${pc.yellow(h.hostname)} - ${pc.green(h.ip)}`,
        })),
      });

      if (isCancel(selection)) {
        outro('Cancelled');
        process.exit(0);
      }

      const hostname = selection as string;
      const hostToManage = currentHosts.find(h => h.hostname === hostname);

      if (!hostToManage) {
        log.error('Host not found');
        process.exit(1);
      }

      // Ask what action to take
      const action = await autocomplete({
        message: `What would you like to do with ${pc.yellow(hostname)} (${pc.green(hostToManage.ip)})?`,
        options: [
          { value: 'update-ip', label: 'Update IP address' },
          { value: 'update-hostname', label: 'Update hostname' },
          { value: 'update-both', label: 'Update both IP and hostname' },
          { value: 'remove', label: 'Remove entry' },
        ],
      });

      if (isCancel(action)) {
        outro('Cancelled');
        process.exit(0);
      }

      if (action === 'update-ip' || action === 'update-hostname' || action === 'update-both') {
        // Update flow
        let newIp = hostToManage.ip;
        let newHostname = hostname;

        // Update IP if requested
        if (action === 'update-ip' || action === 'update-both') {
          const ipInput = await text({
            message: `Enter new IP address for ${pc.yellow(hostname)}:`,
            placeholder: hostToManage.ip,
            defaultValue: hostToManage.ip,
            validate: value => {
              if (value && !this.isIpAddress(value)) return 'Invalid IP address format';
            },
          });

          if (isCancel(ipInput)) {
            outro('Cancelled');
            process.exit(0);
          }

          newIp = (ipInput as string) || hostToManage.ip;
        }

        // Update hostname if requested
        if (action === 'update-hostname' || action === 'update-both') {
          const hostnameInput = await text({
            message: `Enter new hostname:`,
            placeholder: hostname,
            defaultValue: hostname,
            validate: value => {
              if (!value) return 'Hostname is required';
              if (!this.isValidHostname(value)) return 'Invalid hostname format';
            },
          });

          if (isCancel(hostnameInput)) {
            outro('Cancelled');
            process.exit(0);
          }

          newHostname = hostnameInput as string;
        }

        // Check if anything changed
        if (newIp === hostToManage.ip && newHostname === hostname) {
          log.info('No changes made');
          outro('Done');
          return;
        }

        // Check if new hostname already exists (and it's different from current)
        if (newHostname !== hostname) {
          const existingHost = currentHosts.find(h => h.hostname === newHostname);
          if (existingHost) {
            log.error(`Hostname "${newHostname}" already exists with IP ${existingHost.ip}`);
            outro('Cancelled');
            process.exit(1);
          }
        }

        s.start('Updating host entry...');

        // Update the host
        const updatedHosts = currentHosts
          .filter(h => h.hostname !== hostname)
          .map(h => ({ ip: h.ip, hostname: h.hostname }));

        updatedHosts.push({ ip: newIp, hostname: newHostname });

        // Write to hosts file
        await this.writeHostsFile(updatedHosts);

        s.stop('Host entry updated successfully');

        // Show what changed
        if (newIp !== hostToManage.ip && newHostname !== hostname) {
          log.success(
            `Updated: ${pc.yellow(hostname)} (${pc.green(hostToManage.ip)}) → ${pc.yellow(newHostname)} (${pc.green(newIp)})`
          );
        } else if (newIp !== hostToManage.ip) {
          log.success(`Updated IP: ${pc.yellow(hostname)} → ${pc.green(newIp)}`);
        } else {
          log.success(`Updated hostname: ${pc.yellow(hostname)} → ${pc.yellow(newHostname)}`);
        }

        outro('Done! Your /etc/hosts file has been updated.');
      } else {
        // Remove flow
        const shouldRemove = await confirm({
          message: `Remove ${pc.yellow(hostname)} (${pc.green(hostToManage.ip)})?`,
        });

        if (isCancel(shouldRemove) || !shouldRemove) {
          outro('Cancelled');
          process.exit(0);
        }

        s.start('Removing host entry...');

        // Remove the host
        const updatedHosts = currentHosts
          .filter(h => h.hostname !== hostname)
          .map(h => ({ ip: h.ip, hostname: h.hostname }));

        // Write to hosts file
        await this.writeHostsFile(updatedHosts);

        s.stop('Host entry removed successfully');
        log.success(`Removed: ${pc.yellow(hostname)}`);
        outro('Done! Your /etc/hosts file has been updated.');
      }
    } catch (error) {
      s.stop('Failed to manage hosts');
      log.error('Error updating hosts file');
      if (error instanceof Error) {
        log.error(error.message);
      }
      process.exit(1);
    }
  }

  /**
   * Handle removing a host entry
   */
  private async handleRemove(args: string[]): Promise<void> {
    intro(`${compactLogo} Remove Host Entry`);

    const s = spinner();
    s.start('Loading hosts...');

    try {
      // Read current hosts
      const currentHosts = await this.readHostsFile();
      s.stop(`Found ${currentHosts.length} host entries`);

      let hostname = args[0];

      // Interactive mode if hostname not provided
      if (!hostname) {
        if (currentHosts.length === 0) {
          log.warn('No host entries to remove');
          outro('Done');
          return;
        }

        const selection = await autocomplete({
          message: 'Select a host to remove:',
          options: currentHosts.map(h => ({
            value: h.hostname,
            label: `${h.hostname} (${h.ip})`,
          })),
        });

        if (isCancel(selection)) {
          outro('Cancelled');
          process.exit(0);
        }

        hostname = selection as string;
      }

      // Find the host
      const hostToRemove = currentHosts.find(h => h.hostname === hostname);
      if (!hostToRemove) {
        log.error(`Host "${hostname}" not found`);
        process.exit(1);
      }

      // Confirm removal
      const shouldRemove = await confirm({
        message: `Remove ${pc.yellow(hostname)} (${pc.green(hostToRemove.ip)})?`,
      });

      if (isCancel(shouldRemove) || !shouldRemove) {
        outro('Cancelled');
        process.exit(0);
      }

      s.start('Removing host entry...');

      // Remove the host
      const updatedHosts = currentHosts
        .filter(h => h.hostname !== hostname)
        .map(h => ({ ip: h.ip, hostname: h.hostname }));

      // Write to hosts file
      await this.writeHostsFile(updatedHosts);

      s.stop('Host entry removed successfully');
      log.success(`Removed: ${pc.yellow(hostname)}`);
      outro('Done! Your /etc/hosts file has been updated.');
    } catch (error) {
      s.stop('Failed to remove host entry');
      log.error('Error updating hosts file');
      if (error instanceof Error) {
        log.error(error.message);
      }
      process.exit(1);
    }
  }
}
