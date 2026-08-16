/**
 * Demo process configurations. Process ids are stable and human-readable
 * because projectProcesses.id has no default and is supplied by the caller.
 */

export interface DemoProcess {
  id: string;
  projectId: string;
  name: string;
  workingDir: string | null;
  color: string;
  url: string | null;
  order: number;
  commands: string[];
}

export const DEMO_PROCESSES: DemoProcess[] = [
  {
    id: 'demo-proc-01',
    projectId: 'demo-proj-01',
    name: 'API server',
    workingDir: null,
    color: '#00c2e5',
    url: 'http://localhost:4000',
    order: 0,
    commands: ['npm run dev'],
  },
  {
    id: 'demo-proc-02',
    projectId: 'demo-proj-01',
    name: 'Workers',
    workingDir: null,
    color: '#8b5cf6',
    url: null,
    order: 1,
    commands: ['npm run worker'],
  },
  {
    id: 'demo-proc-03',
    projectId: 'demo-proj-01',
    name: 'Database',
    workingDir: null,
    color: '#10b981',
    url: null,
    order: 2,
    commands: ['docker compose up postgres'],
  },
  {
    id: 'demo-proc-04',
    projectId: 'demo-proj-01',
    name: 'Tests',
    workingDir: null,
    color: '#ec4899',
    url: null,
    order: 3,
    commands: ['npm run test:watch'],
  },
  {
    id: 'demo-proc-05',
    projectId: 'demo-proj-02',
    name: 'Storybook',
    workingDir: null,
    color: '#ec4899',
    url: 'http://localhost:6006',
    order: 0,
    commands: ['npm run storybook'],
  },
  {
    id: 'demo-proc-06',
    projectId: 'demo-proj-02',
    name: 'Dev server',
    workingDir: null,
    color: '#00c2e5',
    url: 'http://localhost:5173',
    order: 1,
    commands: ['npm run dev'],
  },
  {
    id: 'demo-proc-07',
    projectId: 'demo-proj-03',
    name: 'Dev server',
    workingDir: null,
    color: '#00c2e5',
    url: 'http://localhost:3000',
    order: 0,
    commands: ['npm run dev'],
  },
  {
    id: 'demo-proc-08',
    projectId: 'demo-proj-04',
    name: 'Pipeline',
    workingDir: null,
    color: '#8b5cf6',
    url: null,
    order: 0,
    commands: ['cargo watch -x run'],
  },
];
