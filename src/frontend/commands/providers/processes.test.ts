import { describe, expect, it, vi } from 'vitest';
import type { ProjectWithDetails } from '../../../shared/types/api';
import type {
  ProcessStatus,
  ProjectProcessStatus,
  StartProcess,
} from '../../../shared/types/process';
import type { Command, CommandContext } from '../types';
import {
  processCommands,
  projectProcessActions,
  stateOf,
  type ProcessCommandDeps,
  type ProcessCommandState,
} from './processes';

const deps = (overrides: Partial<ProcessCommandDeps> = {}): ProcessCommandDeps => ({
  startProcesses: vi.fn(),
  stopProcesses: vi.fn(),
  startProcess: vi.fn(),
  stopProcess: vi.fn(),
  restartProcess: vi.fn(),
  openExternal: vi.fn(),
  ...overrides,
});

const project = (overrides: Partial<ProjectWithDetails> = {}): ProjectWithDetails =>
  ({
    id: 'p1',
    name: 'Alchemy',
    path: '/Users/dev/alchemy',
    technologies: [],
    ...overrides,
  }) as ProjectWithDetails;

const configured = (overrides: Partial<StartProcess> = {}): StartProcess => ({
  id: 'web',
  name: 'web',
  commands: ['npm run dev'],
  ...overrides,
});

const live = (overrides: Partial<ProcessStatus> = {}): ProcessStatus => ({
  processId: 'web',
  projectId: 'p1',
  status: 'running',
  ...overrides,
});

const status = (processes: ProcessStatus[], projectId = 'p1'): ProjectProcessStatus => ({
  projectId,
  processes,
});

/** Nothing fetched and nothing in flight -- a project nobody has opened. */
const unknown = (): ProcessCommandState => ({ configured: {}, loading: {} });

const loaded = (processes: StartProcess[], projectId = 'p1'): ProcessCommandState => ({
  configured: { [projectId]: processes },
  loading: {},
});

const ctx = (): CommandContext => ({
  surface: 'in-app',
  navigate: vi.fn(),
  dismiss: vi.fn(),
  pop: vi.fn(),
});

const actionsOf = (command: Command) => command.actions?.(ctx()) ?? [];

const find = (commands: Command[], fragment: string) =>
  commands.find(command => command.id.includes(fragment));

describe('processCommands', () => {
  it('offers Start for a project that has not been started this session', () => {
    // The bug this fixes: stopping deletes a process's entry, so a stopped
    // project and one that never ran both report zero processes. Keying off
    // process-status meant neither got a Start row -- which is the whole point
    // of the global hotkey.
    const commands = processCommands([project()], [], unknown(), deps());

    expect(commands).toHaveLength(1);
    expect(commands[0].title).toBe('Start Alchemy');
  });

  it('offers nothing for a project known to have no processes configured', () => {
    const commands = processCommands([project()], [], loaded([]), deps());

    expect(commands).toEqual([]);
  });

  it('offers Stop, ranked up, while a project is running', () => {
    const commands = processCommands([project()], [status([live()])], unknown(), deps());

    expect(commands[0].title).toBe('Stop Alchemy');
    expect(commands[0].priority).toBe(3);
  });

  it('starts and stops the whole project from the root row', async () => {
    const dependencies = deps();

    await processCommands([project()], [], unknown(), dependencies)[0].run?.(ctx());
    expect(dependencies.startProcesses).toHaveBeenCalledWith('p1');

    await processCommands([project()], [status([live()])], unknown(), dependencies)[0].run?.(ctx());
    expect(dependencies.stopProcesses).toHaveBeenCalledWith('p1');
  });
});

describe('stateOf', () => {
  it('reads a process missing from status as stopped rather than unknown', () => {
    // Stopping deletes the entry outright, so absence is the ordinary case.
    expect(stateOf(status([]), 'web')).toBe('stopped');
    expect(stateOf(undefined, 'web')).toBe('stopped');
  });

  it('distinguishes running from crashed', () => {
    expect(stateOf(status([live({ status: 'running' })]), 'web')).toBe('running');
    expect(stateOf(status([live({ status: 'failed' })]), 'web')).toBe('failed');
  });
});

describe('projectProcessActions', () => {
  it('shows placeholders while the fetch is in flight', () => {
    const state: ProcessCommandState = { configured: {}, loading: { p1: true } };

    const actions = projectProcessActions(project(), [], state, deps());

    expect(actions.length).toBeGreaterThan(0);
    expect(actions.every(action => action.loading)).toBe(true);
    // A placeholder must not be actionable.
    expect(actions.every(action => !action.run && !action.actions)).toBe(true);
  });

  it('shows nothing before anything has been asked for', () => {
    expect(projectProcessActions(project(), [], unknown(), deps())).toEqual([]);
  });

  it('leads with the bulk Start when nothing is running', () => {
    const actions = projectProcessActions(project(), [], loaded([configured()]), deps());

    expect(actions[0].title).toBe('Start');
    expect(find(actions, 'restart-all')).toBeUndefined();
  });

  it('offers the bulk Stop and Restart once something is running', () => {
    const actions = projectProcessActions(
      project(),
      [status([live()])],
      loaded([configured()]),
      deps()
    );

    expect(actions[0].title).toBe('Stop');
    expect(find(actions, 'restart-all')).toBeDefined();
  });

  it('emits a row per configured process', () => {
    const actions = projectProcessActions(
      project(),
      [],
      loaded([configured(), configured({ id: 'worker', name: 'worker' })]),
      deps()
    );

    expect(find(actions, 'process:p1:web')?.title).toBe('web');
    expect(find(actions, 'process:p1:worker')?.title).toBe('worker');
  });

  it('labels each process by the state the join says it is in', () => {
    const state = loaded([
      configured(),
      configured({ id: 'worker', name: 'worker' }),
      configured({ id: 'db', name: 'db' }),
    ]);
    const statuses = [
      status([live({ processId: 'web' }), live({ processId: 'worker', status: 'failed' })]),
    ];

    const actions = projectProcessActions(project(), statuses, state, deps());

    expect(find(actions, 'process:p1:web')?.subtitle).toBe('Running');
    expect(find(actions, 'process:p1:worker')?.subtitle).toBe('Failed');
    // Never started, so absent from status entirely.
    expect(find(actions, 'process:p1:db')?.subtitle).toBe('Stopped');
  });

  it('restarts rather than starts a crashed process on Enter', async () => {
    // Starting an id that is still tracked spawns nothing and reports success,
    // so a plain Start here would look like the keypress did nothing.
    const dependencies = deps();
    const actions = projectProcessActions(
      project(),
      [status([live({ status: 'failed' })])],
      loaded([configured()]),
      dependencies
    );

    const row = find(actions, 'process:p1:web');
    expect(row?.primaryActionLabel).toBe('Restart');

    await row?.run?.(ctx());
    expect(dependencies.restartProcess).toHaveBeenCalledWith('p1', 'web');
    expect(dependencies.startProcess).not.toHaveBeenCalled();
  });

  it('stops a running process and starts a stopped one on Enter', async () => {
    const dependencies = deps();

    const running = find(
      projectProcessActions(project(), [status([live()])], loaded([configured()]), dependencies),
      'process:p1:web'
    );
    await running?.run?.(ctx());
    expect(dependencies.stopProcess).toHaveBeenCalledWith('p1', 'web');

    const stopped = find(
      projectProcessActions(project(), [], loaded([configured()]), dependencies),
      'process:p1:web'
    );
    await stopped?.run?.(ctx());
    expect(dependencies.startProcess).toHaveBeenCalledWith('p1', 'web');
  });

  it('offers every verb behind a process row', () => {
    const actions = projectProcessActions(
      project(),
      [status([live({ url: 'http://localhost:3000' })])],
      loaded([configured()]),
      deps()
    );

    const verbs = actionsOf(find(actions, 'process:p1:web')!).map(verb => verb.title);

    expect(verbs).toEqual(['Start', 'Stop', 'Restart', 'Open URL', 'View Output']);
  });

  it('omits Open URL when the process has nowhere to go', () => {
    const actions = projectProcessActions(project(), [], loaded([configured()]), deps());

    const verbs = actionsOf(find(actions, 'process:p1:web')!).map(verb => verb.title);

    expect(verbs).not.toContain('Open URL');
  });

  it('prefers a detected URL over the configured one', () => {
    // A dev server that picked its own port knows where it actually is.
    const actions = projectProcessActions(
      project(),
      [status([live({ detectedUrl: 'http://localhost:5174' })])],
      loaded([configured({ url: 'http://localhost:3000' })]),
      deps()
    );

    const openUrl = actionsOf(find(actions, 'process:p1:web')!).find(
      verb => verb.title === 'Open URL'
    );

    expect(openUrl?.subtitle).toBe('http://localhost:5174');
  });

  it('sends View Output to the project’s processes tab', () => {
    const context = ctx();
    const actions = projectProcessActions(project(), [], loaded([configured()]), deps());

    const output = actionsOf(find(actions, 'process:p1:web')!).find(
      verb => verb.title === 'View Output'
    );
    output?.run?.(context);

    expect(context.navigate).toHaveBeenCalledWith('/projects/p1/terminals');
  });

  it('keeps ids unique across projects that name processes the same', () => {
    // Both projects call it "web"; keying on the process id alone would collide
    // and surface as duplicate Vue render keys.
    const first = projectProcessActions(project(), [], loaded([configured()]), deps());
    const second = projectProcessActions(
      project({ id: 'p2', name: 'Barnacles' }),
      [],
      loaded([configured()], 'p2'),
      deps()
    );

    const ids = [...first, ...second].map(action => action.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
