import { Play, Square } from 'lucide-vue-next';
import type { ProjectWithDetails } from '../../../shared/types/api';
import type { ProjectProcessStatus } from '../../../shared/types/process';
import type { Command } from '../types';

export interface ProcessCommandDeps {
  startProcesses: (projectId: string) => void | Promise<void>;
  stopProcesses: (projectId: string) => void | Promise<void>;
}

const hasRunning = (status: ProjectProcessStatus | undefined): boolean =>
  Boolean(status?.processes.some(process => process.status === 'running'));

/**
 * Start/stop a project's configured processes.
 *
 * Both are plain HTTP calls, so this is the headline capability of the global
 * hotkey: start a dev server from inside your editor without the app ever
 * coming to the front. Only the relevant verb is offered per project -- a
 * running project shows Stop, a stopped one shows Start.
 */
export const processCommands = (
  projects: ProjectWithDetails[],
  statuses: ProjectProcessStatus[],
  deps: ProcessCommandDeps
): Command[] =>
  projects.flatMap(project => {
    const status = statuses.find(entry => entry.projectId === project.id);
    const running = hasRunning(status);

    // A project with nothing configured to run has nothing to offer here.
    if (!status || status.processes.length === 0) return [];

    return [
      running
        ? {
            id: `process.stop:${project.id}`,
            title: `Stop ${project.name}`,
            subtitle: 'Running',
            group: 'processes' as const,
            icon: Square,
            keywords: [project.path, 'kill', 'halt', 'dev server'],
            // Running processes are what you most often want to act on.
            priority: 3,
            run: async ctx => {
              await deps.stopProcesses(project.id);
              ctx.dismiss();
            },
          }
        : {
            id: `process.start:${project.id}`,
            title: `Start ${project.name}`,
            group: 'processes' as const,
            icon: Play,
            keywords: [project.path, 'run', 'dev server', 'serve'],
            run: async ctx => {
              await deps.startProcesses(project.id);
              ctx.dismiss();
            },
          },
    ];
  });
