import { confirm, log, spinner } from '@clack/prompts';
import type { ProjectAction } from './types.js';
import type { ProjectWithDetails } from '../../shared/types/api.js';
import type { ProjectProcessStatus } from '../../shared/types/process.js';
import pc from '../utils/colors.js';
import { ensureBackendRunning } from '../utils/app-manager.js';

/**
 * Action to stop running project processes
 */
export class StopAction implements ProjectAction {
  readonly id = 'stop';
  readonly label = 'Stop Processes';
  readonly hint = 'Stop all running processes for this project';

  async execute(project: ProjectWithDetails): Promise<void> {
    try {
      // Ensure backend is running
      const s = spinner();
      s.start('Connecting to Barnacles backend...');
      const backendUrl = await ensureBackendRunning();
      s.stop('Connected to backend');

      if (!backendUrl) {
        log.error('Failed to connect to Barnacles backend. Please start the app manually.');
        return;
      }

      // Get process status via API
      const statusResponse = await fetch(
        `${backendUrl}/api/projects/process-status?projectId=${project.id}`
      );

      if (!statusResponse.ok) {
        throw new Error(`HTTP ${statusResponse.status}: ${statusResponse.statusText}`);
      }

      const statusResult: { data: ProjectProcessStatus } = await statusResponse.json();
      const processStatus = statusResult.data;

      if (!processStatus.processes || processStatus.processes.length === 0) {
        log.info('No processes are running for this project');
        return;
      }

      const runningProcesses = processStatus.processes.filter(p => p.status === 'running');

      if (runningProcesses.length === 0) {
        log.info('No processes are currently running for this project');
        return;
      }

      // Show running processes
      log.step(`Found ${runningProcesses.length} running process(es):`);
      runningProcesses.forEach(p => {
        log.message(`  ${pc.cyan(p.name)} - ${pc.green('Running')}`);
      });

      const shouldStop = await confirm({
        message: `Stop ${runningProcesses.length === 1 ? 'this process' : 'all these processes'}?`,
        initialValue: true,
      });

      if (!shouldStop) {
        log.info('Cancelled');
        return;
      }

      // Stop processes via API
      const stopResponse = await fetch(`${backendUrl}/api/projects/${project.id}/stop`, {
        method: 'POST',
      });

      if (!stopResponse.ok) {
        throw new Error(`HTTP ${stopResponse.status}: ${stopResponse.statusText}`);
      }

      log.success(`Stopped ${runningProcesses.length} process(es)`);
    } catch (error) {
      log.error(
        `Failed to stop processes: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
