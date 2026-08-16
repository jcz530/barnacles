import type { ProjectProcessStatus } from '../../../types/process';

/**
 * Mocked "currently running" processes for demo mode.
 *
 * Process state is in-memory and only exists once something is actually
 * spawned, so a demo run shows every project idle. Spawning real dev servers
 * during a screenshot run is not worth it, so these two projects are reported
 * as live instead — which is what makes the cards show a localhost URL.
 *
 * Only a couple of projects are running on purpose: a dashboard where
 * everything is live looks staged.
 */

/** Process ids match the seeded projectProcesses rows in data/processes.ts. */
export const DEMO_RUNNING_PROCESSES: ProjectProcessStatus[] = [
  {
    projectId: 'demo-proj-01',
    processes: [
      {
        processId: 'demo-proc-01',
        projectId: 'demo-proj-01',
        name: 'API server',
        status: 'running',
        url: 'http://localhost:4000',
        detectedUrl: 'http://localhost:4000',
      },
      {
        processId: 'demo-proc-03',
        projectId: 'demo-proj-01',
        name: 'Database',
        status: 'running',
      },
    ],
  },
  {
    projectId: 'demo-proj-03',
    processes: [
      {
        processId: 'demo-proc-07',
        projectId: 'demo-proj-03',
        name: 'Dev server',
        status: 'running',
        url: 'http://localhost:3000',
        detectedUrl: 'http://localhost:3000',
      },
    ],
  },
];

/** Timestamps are applied at read time so "running for N minutes" stays plausible. */
export function getDemoRunningProcesses(): ProjectProcessStatus[] {
  const startedAt = new Date(Date.now() - 42 * 60 * 1000).toISOString();

  return DEMO_RUNNING_PROCESSES.map(project => ({
    ...project,
    processes: project.processes.map(process => ({ ...process, createdAt: startedAt })),
  }));
}
