import { confirm, log, spinner } from '@clack/prompts';
import type { ProjectAction } from './types.js';
import type { ProjectWithDetails } from '../../shared/types/api.js';
import type { ProjectProcessStatus } from '../../shared/types/process.js';
import pc from '../utils/colors.js';
import { API_ROUTES } from '../../shared/constants/index.js';
import { apiClient } from '../utils/api-client.js';

/**
 * Action to stop running project processes
 */
export class StopAction implements ProjectAction {
  readonly id = 'stop';
  readonly label = 'Stop Processes';
  readonly hint = 'Stop all running processes for this project';

  async execute(project: ProjectWithDetails): Promise<void> {
    try {
      // Get process status via API
      const s = spinner();
      s.start('Checking process status...');
      const processStatus = await apiClient.get<ProjectProcessStatus>(
        `${API_ROUTES.PROJECTS_PROCESS_STATUS}?projectId=${project.id}`
      );
      s.stop('Process status retrieved');

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
      s.start('Stopping processes...');
      await apiClient.post(API_ROUTES.PROJECTS_STOP(project.id));
      s.stop('Processes stopped');

      log.success(`Stopped ${runningProcesses.length} process(es)`);
    } catch (error) {
      log.error(
        `Failed to stop processes: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
