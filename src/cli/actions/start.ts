import { confirm, log, multiselect, spinner } from '@clack/prompts';
import type { ProjectAction } from './types.js';
import type { ProjectWithDetails } from '../../backend/services/project/index.js';
import { projectService } from '../../backend/services/project/index.js';
import type { ProjectProcessStatus, StartProcess } from '../../shared/types/process.js';
import { createId } from '@paralleldrive/cuid2';
import pc from '../utils/colors.js';
import { ensureBackendRunning } from '../utils/app-manager.js';

/**
 * Action to start project processes
 */
export class StartAction implements ProjectAction {
  readonly id = 'start';
  readonly label = 'Start Processes';
  readonly hint = 'Start configured processes or select scripts to run';

  async execute(project: ProjectWithDetails): Promise<void> {
    // Check if there are existing process configurations
    const existingProcesses = await projectService.getStartProcesses(project.id);

    if (existingProcesses.length > 0) {
      // Show existing processes and start them
      log.step(`Found ${existingProcesses.length} configured process(es):`);
      existingProcesses.forEach(p => {
        log.message(`  ${pc.cyan(p.name)}: ${pc.dim(p.commands.join(' && '))}`);
      });

      const shouldStart = await confirm({
        message: 'Start these processes?',
        initialValue: true,
      });

      if (!shouldStart) {
        log.info('Cancelled');
        return;
      }

      try {
        // Ensure backend is running
        const s = spinner();
        s.start('Connecting to Barnacles backend...');
        const backendUrl = await ensureBackendRunning();
        s.stop('Connected to backend');

        if (!backendUrl) {
          log.error('Failed to start Barnacles backend. Please start the app manually.');
          return;
        }

        // Start processes via API
        const response = await fetch(`${backendUrl}/api/projects/${project.id}/start`, {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result: { data: ProjectProcessStatus; message: string } = await response.json();
        const status = result.data;

        const successCount = status.processes.filter(p => p.status === 'running').length;
        log.success(`Started ${successCount} process(es)`);

        // Show status of each process
        status.processes.forEach(p => {
          if (p.status === 'running') {
            log.message(`  ${pc.green('✓')} ${p.name} - Running`);
          } else {
            log.message(`  ${pc.red('✗')} ${p.name} - ${p.error || 'Failed'}`);
          }
        });
      } catch (error) {
        log.error(
          `Failed to start processes: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }

      return;
    }

    // No existing processes - prompt to select scripts
    log.step("No configured processes. Let's set them up!");

    const [packageScripts, composerScripts, packageManager] = await Promise.all([
      projectService.getPackageScripts(project.path),
      projectService.getComposerScripts(project.path),
      projectService.detectPackageManager(project.path),
    ]);

    const packageScriptKeys = Object.keys(packageScripts);
    const composerScriptKeys = Object.keys(composerScripts);

    if (packageScriptKeys.length === 0 && composerScriptKeys.length === 0) {
      log.warn('No package.json or composer.json scripts found in this project.');
      return;
    }

    // Build options for multiselect
    const options: Array<{ value: string; label: string; hint: string }> = [];

    if (packageScriptKeys.length > 0) {
      const pmLabel =
        packageManager === 'yarn' ? 'yarn' : packageManager === 'pnpm' ? 'pnpm' : 'npm run';

      packageScriptKeys.forEach(scriptName => {
        options.push({
          value: `npm:${scriptName}`,
          label: scriptName,
          hint: `${pmLabel} ${scriptName}`,
        });
      });
    }

    if (composerScriptKeys.length > 0) {
      composerScriptKeys.forEach(scriptName => {
        options.push({
          value: `composer:${scriptName}`,
          label: scriptName,
          hint: `composer ${scriptName}`,
        });
      });
    }

    const selectedScripts = (await multiselect({
      message: 'Select scripts to run:',
      options,
      required: true,
    })) as string[];

    if (!selectedScripts || selectedScripts.length === 0) {
      log.info('No scripts selected');
      return;
    }

    // Convert selections to StartProcess configs
    const processes: StartProcess[] = await this.scriptsToProcesses(
      selectedScripts,
      packageManager
    );

    // Save the configuration
    const shouldSave = await confirm({
      message: 'Save this configuration for future use?',
      initialValue: true,
    });

    if (shouldSave) {
      try {
        await projectService.updateStartProcesses(project.id, processes);
        log.success('Configuration saved');
      } catch (error) {
        log.error(
          `Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    // Start the processes
    log.step(`Starting ${processes.length} process(es)...`);

    try {
      // Ensure backend is running
      const s = spinner();
      s.start('Connecting to Barnacles backend...');
      const backendUrl = await ensureBackendRunning();
      s.stop('Connected to backend');

      if (!backendUrl) {
        log.error('Failed to start Barnacles backend. Please start the app manually.');
        return;
      }

      // Start processes via API
      const response = await fetch(`${backendUrl}/api/projects/${project.id}/start`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: { data: ProjectProcessStatus; message: string } = await response.json();
      const status = result.data;

      const successCount = status.processes.filter(p => p.status === 'running').length;
      log.success(`Started ${successCount} process(es)`);

      status.processes.forEach(p => {
        if (p.status === 'running') {
          log.message(`  ${pc.green('✓')} ${p.name} - Running`);
        } else {
          log.message(`  ${pc.red('✗')} ${p.name} - ${p.error || 'Failed'}`);
        }
      });
    } catch (error) {
      log.error(
        `Failed to start processes: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Convert script selections to StartProcess configs
   */
  private async scriptsToProcesses(
    selections: string[],
    packageManager: 'npm' | 'yarn' | 'pnpm'
  ): Promise<StartProcess[]> {
    const colorPalette = [
      '#3b82f6',
      '#10b981',
      '#f59e0b',
      '#ef4444',
      '#8b5cf6',
      '#ec4899',
      '#06b6d4',
    ];

    return selections.map((selection, index) => {
      const [type, scriptName] = selection.split(':');
      let command: string;

      if (type === 'composer') {
        command = `composer ${scriptName}`;
      } else {
        // npm/yarn/pnpm
        command =
          packageManager === 'yarn'
            ? `yarn ${scriptName}`
            : packageManager === 'pnpm'
              ? `pnpm ${scriptName}`
              : `npm run ${scriptName}`;
      }

      return {
        id: createId(),
        name: scriptName.charAt(0).toUpperCase() + scriptName.slice(1).replace(/-/g, ' '),
        commands: [command],
        color: colorPalette[index % colorPalette.length],
      };
    });
  }
}
