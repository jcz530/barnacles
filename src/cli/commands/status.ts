import { compactLogo } from '../utils/branding.js';
import { box, intro, outro, spinner } from '@clack/prompts';
import { Command } from '../core/Command.js';
import { RUNTIME_CONFIG } from '../../shared/constants';
import { db, projects } from '../../shared/database';
import { count } from 'drizzle-orm';
import pc from 'picocolors';

interface ProcessStatus {
  id: string;
  projectId: string;
  command: string;
  status: 'running' | 'stopped' | 'failed';
  url?: string;
}

/**
 * Command to check the status of Barnacles
 */
export class StatusCommand extends Command {
  readonly name = 'status';
  readonly description = 'Check the status of Barnacles';
  readonly showIntro = false;
  readonly helpText =
    'Displays the current status of the Barnacles application, database connection, and running processes.';
  readonly examples = ['barnacles status', 'barnacles status --help'];

  async execute(): Promise<void> {
    intro(`${compactLogo} Barnacles Status`);

    const s = spinner();
    s.start('Checking system status...');

    const API_BASE_URL = RUNTIME_CONFIG.API_BASE_URL;
    // Check app status
    let appStatus = 'offline';
    let dbStatus;
    let projectCount = 0;
    let runningProcesses = 0;

    // Try to query database directly to verify connectivity and get project count
    try {
      const result = await db.select({ count: count() }).from(projects);
      dbStatus = 'connected';
      projectCount = result[0]?.count ?? 0;
    } catch {
      dbStatus = 'error';
    }

    try {
      const healthResponse = await globalThis.fetch(`${API_BASE_URL}/health`);
      if (healthResponse.ok) {
        appStatus = 'running';
        await healthResponse.json();

        // Check for running processes
        try {
          const processesResponse = await globalThis.fetch(`${API_BASE_URL}/processes`);
          if (processesResponse.ok) {
            const processes: ProcessStatus[] = await processesResponse.json();
            runningProcesses = processes.filter(p => p.status === 'running').length;
          }
        } catch {
          // Process endpoint might not be available
        }
      }
    } catch {
      appStatus = 'offline';
      dbStatus = 'disconnected';
    }

    // Display status information
    const statusInfo = [
      `App: ${appStatus === 'running' ? '✓ running' : '✗ offline'}`,
      `Database: ${dbStatus === 'connected' ? '✓ connected' : dbStatus === 'error' ? '✗ error' : '✗ disconnected'}`,
      `Projects: ${projectCount}`,
      `Running Processes: ${runningProcesses}`,
    ].join('\n');

    box(statusInfo, 'Status');

    s.stop('Status check complete');
    // Show warning if app is offline
    if (appStatus === 'offline') {
      outro(pc.dim('Barnacles app is not running. Tip: open the app with `barnacles open`'));
    }
  }
}
