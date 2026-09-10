import { describe, expect, it, vi } from 'vitest';
import type { ProjectWithDetails } from '../../../shared/types/api';
import type {
  ProcessStatus,
  ProjectProcessStatus,
  StartProcess,
} from '../../../shared/types/process';
import type { Command, CommandContext } from '../types';
import {
  formatUrl,
  processCommands,
  projectProcessActions,
  runningCount,
  runningUrls,
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

/** Configured by default; the unconfigured case is the exception under test. */
const project = (overrides: Partial<ProjectWithDetails> = {}): ProjectWithDetails =>
  ({
    id: 'p1',
    name: 'Alchemy',
    path: '/Users/dev/alchemy',
    technologies: [],
    hasStartProcesses: true,
    ...overrides,
  }) as ProjectWithDetails;

/** A project with no start command configured. */
const unconfigured = (overrides: Partial<ProjectWithDetails> = {}): ProjectWithDetails =>
  project({ hasStartProcesses: false, ...overrides });

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
  status: vi.fn(),
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

  it('offers nothing at root for a project with no start command configured', () => {
    // The bug: an unconfigured project used to get an optimistic Start row that
    // failed on Enter with a generic message. Typing "start" should only ever
    // offer projects that can actually start.
    const commands = processCommands([unconfigured()], [], unknown(), deps());

    expect(commands).toEqual([]);
  });

  it('keeps an unconfigured project out of root without having fetched anything', () => {
    // The flag answers this, so no round trip is needed first -- the row is
    // absent from the first frame rather than appearing and then vanishing.
    expect(processCommands([unconfigured()], [], unknown(), deps())).toEqual([]);
    expect(processCommands([unconfigured()], [], loaded([]), deps())).toEqual([]);
  });

  it('still offers configured projects alongside unconfigured ones', () => {
    const commands = processCommands(
      [unconfigured({ id: 'p1', name: 'Alchemy' }), project({ id: 'p2', name: 'Barnacles' })],
      [],
      unknown(),
      deps()
    );

    expect(commands).toHaveLength(1);
    expect(commands[0].title).toBe('Start Barnacles');
  });

  it('offers nothing at root for a project that is already running', () => {
    // Stop used to live here, which gave every running project two root rows --
    // itself and "Stop <project>" -- for a verb reached far less often than the
    // glance at what is up. It moved into the project's own level; the project
    // row carries the running mark that leads there.
    const commands = processCommands([project()], [status([live()])], unknown(), deps());

    expect(commands).toEqual([]);
  });

  it('offers Start again once a project stops', () => {
    const stopped = status([live({ status: 'stopped' })]);

    const commands = processCommands([project()], [stopped], unknown(), deps());

    expect(commands).toHaveLength(1);
    expect(commands[0].title).toBe('Start Alchemy');
  });

  it('starts the whole project from the root row', async () => {
    const dependencies = deps();

    await processCommands([project()], [], unknown(), dependencies)[0].run?.(ctx());

    expect(dependencies.startProcesses).toHaveBeenCalledWith('p1');
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

  it('offers to configure a start command when the project has none', () => {
    // Previously an empty group: the level simply had no Processes section, so
    // there was nothing to explain the absence and no way to fix it.
    const actions = projectProcessActions(unconfigured(), [], unknown(), deps());

    expect(actions).toHaveLength(1);
    expect(actions[0].title).toBe('Configure Start Command');
    expect(actions[0].subtitle).toBe('Not configured');
  });

  it('offers the configure row without waiting for a fetch', () => {
    // The flag is on the project, so this does not sit behind a placeholder for
    // a list that is going to come back empty.
    const inFlight: ProcessCommandState = { configured: {}, loading: { p1: true } };

    const actions = projectProcessActions(unconfigured(), [], inFlight, deps());

    expect(actions).toHaveLength(1);
    expect(actions[0].loading).toBeUndefined();
  });

  it('deep-links the configure row to the project page editor', async () => {
    const context = ctx();

    await projectProcessActions(unconfigured(), [], unknown(), deps())[0].run?.(context);

    expect(context.navigate).toHaveBeenCalledWith('/projects/p1/overview?configure=processes');

    // Re-parsed rather than only string-matched, so a typo in the param name
    // cannot pass by looking approximately right.
    const path = vi.mocked(context.navigate).mock.calls[0][0];
    expect(new URLSearchParams(path.split('?')[1]).get('configure')).toBe('processes');
  });

  it('falls back to the configure row when the fetched list is empty', () => {
    // The flag said yes but the list came back empty -- a process deleted
    // elsewhere while the projects list was still cached. Better than the empty
    // group this used to render.
    const actions = projectProcessActions(project(), [], loaded([]), deps());

    expect(actions).toHaveLength(1);
    expect(actions[0].title).toBe('Configure Start Command');
  });

  it('is still findable by the words for the thing it is missing', () => {
    const actions = projectProcessActions(unconfigured(), [], unknown(), deps());

    expect(actions[0].keywords).toEqual(expect.arrayContaining(['start', 'run']));
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

  it('starts a stopped process on Enter', async () => {
    const dependencies = deps();

    const stopped = find(
      projectProcessActions(project(), [], loaded([configured()]), dependencies),
      'process:p1:web'
    );

    await stopped?.run?.(ctx());

    expect(dependencies.startProcess).toHaveBeenCalledWith('p1', 'web');
  });

  it('restarts a crashed process on Enter', async () => {
    const dependencies = deps();

    const failed = find(
      projectProcessActions(
        project(),
        [status([live({ status: 'failed' })])],
        loaded([configured()]),
        dependencies
      ),
      'process:p1:web'
    );

    await failed?.run?.(ctx());

    expect(dependencies.restartProcess).toHaveBeenCalledWith('p1', 'web');
  });

  it('opens the actions rather than stopping when a process is running', async () => {
    // Enter used to stop outright, on a row already showing the chevron that
    // promises a list -- so the key that opens one everywhere else in the
    // palette killed a dev server here. A running process has several verbs
    // worth reaching for and no obvious default, so the choice is the action.
    const dependencies = deps();

    const running = find(
      projectProcessActions(project(), [status([live()])], loaded([configured()]), dependencies),
      'process:p1:web'
    );

    expect(running?.run).toBeUndefined();
    expect(running?.actions).toBeDefined();
    expect(dependencies.stopProcess).not.toHaveBeenCalled();
  });

  it('leads with Stop inside a running process, so stopping stays two keys', () => {
    const running = find(
      projectProcessActions(project(), [status([live()])], loaded([configured()]), deps()),
      'process:p1:web'
    );

    expect(actionsOf(running!).map(verb => verb.title)[0]).toBe('Stop');
  });

  it('offers every verb behind a process row', () => {
    const actions = projectProcessActions(
      project(),
      [status([live({ url: 'http://localhost:3000' })])],
      loaded([configured()]),
      deps()
    );

    const verbs = actionsOf(find(actions, 'process:p1:web')!).map(verb => verb.title);

    // Stop leads while it is running: Enter opens this list rather than
    // stopping, and Start would do nothing to a process already up.
    expect(verbs).toEqual(['Stop', 'Start', 'Restart', 'Open URL', 'View Output']);
  });

  it('leads with Start once the process is stopped', () => {
    const actions = projectProcessActions(project(), [], loaded([configured()]), deps());

    const verbs = actionsOf(find(actions, 'process:p1:web')!).map(verb => verb.title);

    expect(verbs.slice(0, 2)).toEqual(['Start', 'Stop']);
  });

  it('omits Open URL when the process has nowhere to go', () => {
    const actions = projectProcessActions(project(), [], loaded([configured()]), deps());

    const verbs = actionsOf(find(actions, 'process:p1:web')!).map(verb => verb.title);

    expect(verbs).not.toContain('Open URL');
  });

  it('prefers a detected URL over the configured one', () => {
    // A dev server that picked its own port knows where it actually is.
    //
    // The fixture mirrors what the backend really sends: status builds `url` as
    // `configuredUrl || detectedUrl`, so a configured process reports BOTH, with
    // url holding the configured value. Testing with url absent passed against a
    // shape the backend never emits.
    const actions = projectProcessActions(
      project(),
      [status([live({ url: 'http://localhost:3000', detectedUrl: 'http://localhost:5174' })])],
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

describe('reporting what a process verb did', () => {
  it('stays open and confirms, so the row can be watched flipping', async () => {
    // The row itself is the confirmation -- it goes Start -> Stop as the status
    // query catches up -- so closing would hide the very thing that proves the
    // press landed.
    const dependencies = deps();
    const context = ctx();
    const [row] = processCommands([project()], [], loaded([configured()]), dependencies);

    await row.run?.(context);

    expect(dependencies.startProcesses).toHaveBeenCalledWith('p1');
    expect(context.status).toHaveBeenCalledWith('Started Alchemy');
    expect(context.dismiss).not.toHaveBeenCalled();
  });

  it('says so when starting fails rather than looking like nothing happened', async () => {
    const dependencies = deps();
    vi.mocked(dependencies.startProcesses).mockRejectedValue(new Error('port in use'));
    const context = ctx();
    const [row] = processCommands([project()], [], loaded([configured()]), dependencies);

    await row.run?.(context);

    expect(context.status).toHaveBeenCalledWith('Could not start Alchemy', 'error');
  });

  it('names the missing configuration rather than blaming the start', async () => {
    // Reachable despite unconfigured projects having no Start row: the projects
    // list is cached, so a process deleted elsewhere can leave a row briefly
    // outliving what it starts. "Could not start" would describe a broken
    // command rather than a missing one.
    //
    // The message arrives wrapped by Electron's IPC boundary, which is why the
    // check is a substring test -- this reproduces that wrapping.
    const dependencies = deps();
    vi.mocked(dependencies.startProcesses).mockRejectedValue(
      new Error(
        "Error invoking remote method 'api-call': Error: No start processes configured for this project"
      )
    );
    const context = ctx();
    const [row] = processCommands([project()], [], loaded([configured()]), dependencies);

    await row.run?.(context);

    expect(context.status).toHaveBeenCalledWith('No start command configured for Alchemy', 'error');
  });

  /** One configured process's own verbs, which hang off its row in the level. */
  const verbsFor = (
    processes: ProcessStatus[],
    entry: StartProcess,
    dependencies = deps()
  ): Command[] => {
    const rows = projectProcessActions(
      project(),
      [status(processes)],
      loaded([entry]),
      dependencies
    );
    return actionsOf(find(rows, `process:p1:${entry.id}`)!);
  };

  it('names the process, not the project, for a single process verb', async () => {
    const context = ctx();
    const entry = configured({ id: 'api', name: 'api' });

    await find(verbsFor([live({ processId: 'api' })], entry), '.stop')?.run?.(context);

    expect(context.status).toHaveBeenCalledWith('Stopped api');
  });

  it('still closes for View Output, which needs a window', async () => {
    // The one verb here that leaves the palette: from the floating window it
    // raises or creates a main window to show the logs in.
    const context = ctx();

    await find(verbsFor([live()], configured()), '.output')?.run?.(context);

    expect(context.navigate).toHaveBeenCalledWith('/projects/p1/terminals');
  });
});

describe('runningUrls', () => {
  it('prefers the address the server actually picked', () => {
    // process-status builds `url` as `configuredUrl || detectedUrl`, so it is
    // the configured one whenever there is one -- and a stale guess by the time
    // the server has chosen its own port.
    const urls = runningUrls(
      status([live({ url: 'http://localhost:3000', detectedUrl: 'http://localhost:5174' })]),
      [configured({ url: 'http://localhost:8080' })]
    );

    expect(urls.map(entry => entry.url)).toEqual(['http://localhost:5174']);
  });

  it('falls back through the configured process when status carries none', () => {
    const urls = runningUrls(status([live()]), [configured({ url: 'http://localhost:8080' })]);

    expect(urls.map(entry => entry.url)).toEqual(['http://localhost:8080']);
  });

  it('skips a process with no address anywhere', () => {
    expect(runningUrls(status([live()]), [configured()])).toEqual([]);
    expect(runningUrls(status([live()]), undefined)).toEqual([]);
  });

  it('ignores anything not running', () => {
    // A stopped process's url points at nothing, and offering to open it is
    // worse than not offering.
    const stopped = status([live({ status: 'stopped', url: 'http://localhost:3000' })]);
    const failed = status([live({ status: 'failed', url: 'http://localhost:3000' })]);

    expect(runningUrls(stopped, [configured()])).toEqual([]);
    expect(runningUrls(failed, [configured()])).toEqual([]);
  });

  it('names each process, so several can be told apart', () => {
    const urls = runningUrls(
      status([
        live({ processId: 'api', name: 'api', detectedUrl: 'http://localhost:8080' }),
        live({ processId: 'web', name: 'web', detectedUrl: 'http://localhost:5173' }),
      ]),
      undefined
    );

    expect(urls.map(entry => entry.name)).toEqual(['api', 'web']);
  });

  it('takes the name from the configured process when status omits it', () => {
    const urls = runningUrls(status([live({ detectedUrl: 'http://localhost:5173' })]), [
      configured({ name: 'dev server' }),
    ]);

    expect(urls[0].name).toBe('dev server');
  });

  it('has nothing to report for a project with no status at all', () => {
    expect(runningUrls(undefined, undefined)).toEqual([]);
  });
});

describe('runningCount', () => {
  it('counts only what is alive', () => {
    const mixed = status([
      live({ processId: 'a' }),
      live({ processId: 'b' }),
      live({ processId: 'c', status: 'stopped' }),
      live({ processId: 'd', status: 'failed' }),
    ]);

    expect(runningCount(mixed)).toBe(2);
    expect(runningCount(undefined)).toBe(0);
  });
});

describe('formatUrl', () => {
  it('reads it the way a person says it', () => {
    expect(formatUrl('http://localhost:5173')).toBe('localhost:5173');
    expect(formatUrl('https://app.test.dev')).toBe('app.test.dev');
  });

  it('drops a bare root path but keeps a real one', () => {
    expect(formatUrl('http://localhost:5173/')).toBe('localhost:5173');
    expect(formatUrl('http://localhost:5173/admin')).toBe('localhost:5173/admin');
  });

  it('keeps a query string, which changes where the row goes', () => {
    // The bare root path still goes; the query that follows it does not.
    expect(formatUrl('http://localhost:8080/?token=abc')).toBe('localhost:8080?token=abc');
    expect(formatUrl('http://localhost:5173/#/admin')).toBe('localhost:5173#/admin');
    expect(formatUrl('http://localhost:8080/api?v=2')).toBe('localhost:8080/api?v=2');
  });

  it('leaves anything unparseable alone', () => {
    // Better than dropping a row whose url would have opened fine.
    expect(formatUrl('localhost:5173')).toBe('localhost:5173');
  });
});
