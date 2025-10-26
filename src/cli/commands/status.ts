import { compactLogo } from '../utils/branding.js';
import { box, intro, outro, spinner } from '@clack/prompts';
import { Command } from '../core/Command.js';
import { db, projects } from '../../shared/database';
import { count } from 'drizzle-orm';
import pc from 'picocolors';
import { getBackendUrl } from '../utils/app-manager.js';

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

    // Check app status using reusable utility
    const backendUrl = await getBackendUrl();
    const appStatus = backendUrl ? 'running' : 'offline';
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

    // If backend is running, check for running processes
    if (backendUrl) {
      try {
        const processesResponse = await globalThis.fetch(
          `${backendUrl}/api/projects/process-status`
        );
        if (processesResponse.ok) {
          const result = await processesResponse.json();
          // Count running processes across all projects
          if (result.data && Array.isArray(result.data)) {
            runningProcesses = result.data.reduce(
              (
                total: number,
                projectStatus: {
                  processes?: Array<{ status: string }>;
                }
              ) => {
                return (
                  total + (projectStatus.processes?.filter(p => p.status === 'running').length || 0)
                );
              },
              0
            );
          }
        }
      } catch {
        // Process endpoint might not be available
      }
    } else {
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
