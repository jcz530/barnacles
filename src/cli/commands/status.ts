import { compactLogo } from '../utils/branding.js';
import { box, intro, outro, spinner } from '@clack/prompts';
import { Command } from '../core/Command.js';
import pc from 'picocolors';
import { apiClient } from '../utils/api-client.js';

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

    // Check app status using API client (which will launch app if needed)
    const backendUrl = await apiClient.getBackendUrl();
    const appStatus = backendUrl ? 'running' : 'offline';
    let projectCount = 0;
    let runningProcesses = 0;

    // If backend is running, get project count and running processes via API
    if (backendUrl) {
      try {
        // Get project count via API
        const projects = await apiClient.get<Array<{ id: string }>>('/api/projects');
        projectCount = projects.length;

        // Get running processes via API
        const processesResponse = await apiClient.get<
          Array<{ processes?: Array<{ status: string }> }>
        >('/api/projects/process-status');

        // Count running processes across all projects
        runningProcesses = processesResponse.reduce(
          (total, projectStatus) =>
            total + (projectStatus.processes?.filter(p => p.status === 'running').length || 0),
          0
        );
      } catch {
        // API might not be available
      }
    }

    // Display status information
    const statusInfo = [
      `App: ${appStatus === 'running' ? '✓ running' : '✗ offline'}`,
      `Projects: ${projectCount}`,
      `Running Processes: ${runningProcesses}`,
    ].join('\n');

    box(statusInfo, 'Status');

    s.stop('Status check complete');
    // Show warning if app is offline
    if (appStatus === 'offline') {
      outro(pc.dim('Barnacles app is not running. Launch it with `barnacles` commands.'));
    }
  }
}
