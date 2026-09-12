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

/**
 * Scrollback replayed when a demo process is attached to.
 *
 * The processes above are status rows with no PTY behind them, so attaching
 * used to be refused and the output pane rendered "[Process not found]" — which
 * is what every screenshot of the terminals tab captured. Seeding plausible log
 * lines keeps that pane looking like the feature it illustrates.
 *
 * Lines end with \r\n because they are written straight into xterm.js.
 */
const DEMO_PROCESS_OUTPUT: Record<string, string[]> = {
  'demo-proc-01': [
    '> harbor-api@1.4.0 dev\r\n',
    '> tsx watch src/server.ts\r\n',
    '\r\n',
    'harbor-api listening on http://localhost:4000\r\n',
    'GraphQL playground ready at /graphql\r\n',
    'connected to postgres (harbor_dev)\r\n',
    'GET /graphql 200 12ms\r\n',
    'POST /graphql 200 34ms\r\n',
  ],
  'demo-proc-03': [
    'postgres 16.2 starting\r\n',
    'listening on port 5432\r\n',
    'database system is ready to accept connections\r\n',
  ],
  'demo-proc-07': [
    '> lighthouse-web@0.8.1 dev\r\n',
    '> next dev\r\n',
    '\r\n',
    '  ▲ Next.js 14.2.3\r\n',
    '  - Local:  http://localhost:3000\r\n',
    '\r\n',
    ' ✓ Ready in 1.2s\r\n',
    ' ✓ Compiled /page in 340ms\r\n',
  ],
};

/** Seeded scrollback for a demo process, or null when the id is not a fixture. */
export function getDemoProcessOutput(processId: string): string[] | null {
  return DEMO_PROCESS_OUTPUT[processId] ?? null;
}

/** Timestamps are applied at read time so "running for N minutes" stays plausible. */
export function getDemoRunningProcesses(): ProjectProcessStatus[] {
  const startedAt = new Date(Date.now() - 42 * 60 * 1000).toISOString();

  return DEMO_RUNNING_PROCESSES.map(project => ({
    ...project,
    processes: project.processes.map(process => ({ ...process, createdAt: startedAt })),
  }));
}
