import { AlertTriangle, Link, Play, RotateCw, ScrollText, Settings, Square } from 'lucide-vue-next';
import type { ProjectWithDetails } from '../../../shared/types/api';
import type {
  ProcessStatus,
  ProjectProcessStatus,
  StartProcess,
} from '../../../shared/types/process';
import { CONFIGURE_PROCESSES } from '@/composables/useConfigureProcessesParam';
import type { Command, CommandContext } from '../types';

export interface ProcessCommandDeps {
  startProcesses: (projectId: string) => void | Promise<void>;
  stopProcesses: (projectId: string) => void | Promise<void>;
  startProcess: (projectId: string, processId: string) => void | Promise<void>;
  stopProcess: (projectId: string, processId: string) => void | Promise<void>;
  restartProcess: (projectId: string, processId: string) => void | Promise<void>;
  openExternal: (url: string) => void | Promise<void>;
}

/**
 * What the palette knows about each project's configured processes.
 *
 * Fetched only for projects someone has drilled into, so a project absent from
 * `configured` has not been looked at rather than having nothing to run.
 */
export interface ProcessCommandState {
  configured: Record<string, StartProcess[]>;
  /** Projects whose fetch is in flight, so a level can say so. */
  loading: Record<string, boolean>;
}

/** A configured process is running, crashed, or simply not started. */
export type ProcessRowState = 'running' | 'failed' | 'stopped';

const liveEntry = (
  status: ProjectProcessStatus | undefined,
  processId: string
): ProcessStatus | undefined => status?.processes.find(entry => entry.processId === processId);

/**
 * A configured process's state, from the two halves that describe it.
 *
 * The configured list says what exists; process-status says what is alive. The
 * two have to be joined because stopping deletes a process's entry outright --
 * so "missing from process-status" is the ordinary stopped case, not an error,
 * and status alone cannot tell a stopped project from an unknown one.
 */
export const stateOf = (
  status: ProjectProcessStatus | undefined,
  processId: string
): ProcessRowState => {
  const entry = liveEntry(status, processId);
  if (!entry) return 'stopped';
  if (entry.status === 'running') return 'running';
  if (entry.status === 'failed') return 'failed';
  return 'stopped';
};

export const hasRunning = (status: ProjectProcessStatus | undefined): boolean =>
  Boolean(status?.processes.some(process => process.status === 'running'));

/** How many of a project's processes are alive, for a row that has to say so. */
export const runningCount = (status: ProjectProcessStatus | undefined): number =>
  status?.processes.filter(process => process.status === 'running').length ?? 0;

/** A running process and the address it answers on. */
export interface RunningUrl {
  processId: string;
  /** The process's name, for a row that has to tell several apart. */
  name: string;
  url: string;
}

/**
 * Where a project's running processes can actually be reached.
 *
 * The detected url first, for the same reason processRow prefers it: a dev
 * server that picked its own port knows where it ended up, and the configured
 * one is a stale guess by then. `live.url` is not a third option so much as the
 * configured one under another name -- process-status builds it as
 * `configuredUrl || detectedUrl` -- so it sits behind the detected value.
 *
 * Running only. A stopped process's url points at nothing, and offering to open
 * it is worse than not offering.
 */
export const runningUrls = (
  status: ProjectProcessStatus | undefined,
  configured: StartProcess[] | undefined
): RunningUrl[] =>
  (status?.processes ?? [])
    .filter(process => process.status === 'running')
    .flatMap(process => {
      const fallback = configured?.find(entry => entry.id === process.processId);
      const url = process.detectedUrl ?? process.url ?? fallback?.url;
      if (!url) return [];

      return [
        {
          processId: process.processId,
          name: process.name ?? fallback?.name ?? process.title ?? 'Process',
          url,
        },
      ];
    });

/**
 * A url as a person refers to it: 'localhost:5173', not
 * 'http://localhost:5173/'.
 *
 * Matches how the ports provider titles the same action, so "Open
 * localhost:5173" means one thing in the palette wherever it appears. Falls
 * back to the raw string for anything that is not an http url, which is better
 * than dropping a row that would otherwise open fine.
 *
 * The protocol is checked rather than trusting the parse to throw: URL happily
 * reads 'localhost:5173' as the scheme 'localhost:' with path '5173', so a
 * catch alone would let a bare host through as "Open 5173" -- a number that
 * names nothing.
 */
export const formatUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return url;

    const path = parsed.pathname === '/' ? '' : parsed.pathname;
    return `${parsed.host}${path}`;
  } catch {
    return url;
  }
};

/** The three process verbs, in both tenses a message needs. */
const VERBS = {
  start: { done: 'Started', failed: 'start' },
  stop: { done: 'Stopped', failed: 'stop' },
  restart: { done: 'Restarted', failed: 'restart' },
} as const;

/**
 * Run a process verb, stay open, and say what happened.
 *
 * These all stay open: the row itself reports the result -- it flips between
 * Start and Stop as the status query catches up -- so closing would hide the
 * very thing that confirms the press. Starting several processes in a row is
 * also ordinary, and each one costing a reopen is what made this worth changing.
 */
const processAction = async (
  ctx: CommandContext,
  act: () => void | Promise<void>,
  verb: keyof typeof VERBS,
  subject: string
): Promise<void> => {
  try {
    await act();
    ctx.status(`${VERBS[verb].done} ${subject}`);
  } catch (error) {
    if (isNotConfigured(error)) {
      ctx.status(`No start command configured for ${subject}`, 'error');
      return;
    }
    ctx.status(`Could not ${VERBS[verb].failed} ${subject}`, 'error');
  }
};

/**
 * The backend's phrasing when a project has nothing to start.
 * See POST /:id/start in routes/projects/processes.ts.
 */
const NOT_CONFIGURED = 'No start processes configured';

/**
 * Whether a failure was "nothing is configured" rather than a real fault.
 *
 * Reachable even though unconfigured projects no longer offer a Start row: the
 * projects list is cached, so a process deleted elsewhere can leave a row
 * briefly outliving the thing it starts. Saying so beats "Could not start",
 * which describes a broken command rather than a missing one.
 *
 * Matched on the message because that is all that survives: api-bridge attaches
 * the response body to the Error, but only `message` crosses Electron's IPC
 * boundary -- and it arrives wrapped in the "Error invoking remote method"
 * prefix, so this has to be a substring test rather than an equality one.
 */
const isNotConfigured = (error: unknown): boolean =>
  error instanceof Error && error.message.includes(NOT_CONFIGURED);

/**
 * Start a project's processes, one row per stoppable project.
 *
 * A plain HTTP call, so this is the headline capability of the global hotkey:
 * start a dev server from inside your editor without the app ever coming to the
 * front.
 *
 * Start only. Stopping used to have a matching root row, which meant every
 * running project occupied two entries -- "Barnacles" and "Stop Barnacles" --
 * for a verb you reach for far less often than you glance at what is alive.
 * Stop now lives in the project's own level, next to Restart and the individual
 * processes, and the project row carries the running dot that gets you there.
 * The words still find it: the project row keywords 'stop', so typing it lands
 * on the row whose level does the stopping.
 */
export const processCommands = (
  projects: ProjectWithDetails[],
  statuses: ProjectProcessStatus[],
  state: ProcessCommandState,
  deps: ProcessCommandDeps
): Command[] =>
  projects.flatMap(project => {
    const status = statuses.find(entry => entry.projectId === project.id);

    // A project with no start command configured has nothing to start, so it
    // stays out of the root list entirely -- typing "start" should offer only
    // projects that can actually start.
    //
    // This reads the flag on the project rather than the lazily fetched
    // `configured` list, which is only populated for projects someone has
    // drilled into. Going by that list meant a project nobody had opened got an
    // optimistic Start row that failed on Enter, and process-status cannot
    // answer it either: it omits stopped projects entirely, so "not running"
    // and "nothing to run" look identical there.
    //
    // Configuring one is offered inside the project's own level, where you have
    // arrived meaning to act on that project. See projectProcessActions.
    if (!project.hasStartProcesses) return [];

    // Already up, so there is nothing to start. The project row says it is
    // running and its level holds Stop and Restart.
    if (hasRunning(status)) return [];

    return [
      {
        id: `process.start:${project.id}`,
        title: `Start ${project.name}`,
        group: 'processes' as const,
        icon: Play,
        primaryActionLabel: 'Start',
        keywords: [project.path, 'run', 'dev server', 'serve', 'processes'],
        run: ctx =>
          processAction(ctx, () => deps.startProcesses(project.id), 'start', project.name),
      },
    ];
  });

/**
 * The Processes group shown inside a project's own action level.
 *
 * The whole-project verbs come first -- acting on everything is the common
 * case, and burying them under the individual rows would make the level read as
 * a list of processes rather than a project's controls.
 *
 * They are named for the verb alone rather than "Start All Processes": most
 * projects configure exactly one process, where "all" is a grand word for
 * running `npm run dev`. The rows beneath name their own process, so which is
 * the bulk verb and which is a single one stays clear from the list.
 */
export const projectProcessActions = (
  project: ProjectWithDetails,
  statuses: ProjectProcessStatus[],
  state: ProcessCommandState,
  deps: ProcessCommandDeps
): Command[] => {
  const status = statuses.find(entry => entry.projectId === project.id);
  const configured = state.configured[project.id];

  // Nothing configured, which the project itself knows without waiting for the
  // fetch -- so this row is on screen from the first frame rather than after a
  // round trip, and no placeholder is needed for a list that will be empty.
  if (!project.hasStartProcesses) return [configureAction(project)];

  if (!configured) {
    // Still arriving. Placeholders hold the group's shape so the level does not
    // visibly reflow when the real rows land.
    return state.loading[project.id]
      ? [0, 1].map(index => ({
          id: `process.loading:${project.id}:${index}`,
          title: 'Loading processes…',
          group: 'processes' as const,
          loading: true,
        }))
      : [];
  }

  // The flag said there were processes but the fetched list is empty -- the
  // list was stale, and one was deleted in between. Offer the same row rather
  // than an empty group.
  if (configured.length === 0) return [configureAction(project)];

  const anyRunning = configured.some(entry => stateOf(status, entry.id) === 'running');

  return [
    anyRunning
      ? {
          id: `project.processes.stop-all:${project.id}`,
          title: 'Stop',
          group: 'processes' as const,
          icon: Square,
          primaryActionLabel: 'Stop',
          keywords: ['kill', 'halt', 'stop'],
          run: (ctx: CommandContext) =>
            processAction(ctx, () => deps.stopProcesses(project.id), 'stop', project.name),
        }
      : {
          id: `project.processes.start-all:${project.id}`,
          title: 'Start',
          group: 'processes' as const,
          icon: Play,
          primaryActionLabel: 'Start',
          keywords: ['run', 'serve', 'start'],
          run: (ctx: CommandContext) =>
            processAction(ctx, () => deps.startProcesses(project.id), 'start', project.name),
        },
    // Stopping the project deletes its whole map, so the start that follows
    // genuinely spawns -- no per-process eviction needed for the bulk verb.
    ...(anyRunning
      ? [
          {
            id: `project.processes.restart-all:${project.id}`,
            title: 'Restart',
            group: 'processes' as const,
            icon: RotateCw,
            primaryActionLabel: 'Restart',
            keywords: ['reload', 'bounce', 'restart'],
            run: (ctx: CommandContext) =>
              processAction(
                ctx,
                async () => {
                  await deps.stopProcesses(project.id);
                  await deps.startProcesses(project.id);
                },
                'restart',
                project.name
              ),
          },
        ]
      : []),
    ...configured.map(entry => processRow(project, entry, status, deps)),
  ];
};

/**
 * The row a project with no start command gets, in place of its processes.
 *
 * Named and iconed to match StartProcessButton's own "Configure Start" state,
 * so the palette and the project page agree about what an unconfigured project
 * offers rather than describing it two different ways.
 *
 * Navigating is the point: configuring means the process editor, which only the
 * project page has. From the floating palette that raises a main window, which
 * is the one thing here that needs one -- but a person asking to configure a
 * process is heading for the app anyway.
 */
const configureAction = (project: ProjectWithDetails): Command => ({
  id: `project.processes.configure:${project.id}`,
  title: 'Configure Start Command',
  subtitle: 'Not configured',
  group: 'processes' as const,
  icon: Settings,
  primaryActionLabel: 'Configure',
  // The words for the thing that is missing, so someone who came here by typing
  // "start" still lands on the row that gets them one.
  keywords: ['start', 'run', 'dev server', 'serve', 'setup', 'configure', 'processes'],
  run: (ctx: CommandContext) => ctx.navigate(configureRoute(project.id)),
});

/**
 * Where the process editor lives.
 *
 * A query param rather than a route of its own: the editor is a sheet owned by
 * the project page, and the param is read once on arrival. See ProjectDetail.
 */
export const configureRoute = (projectId: string): string =>
  `/projects/${projectId}/overview?configure=${CONFIGURE_PROCESSES}`;

/** One configured process, with its verbs behind it. */
const processRow = (
  project: ProjectWithDetails,
  entry: StartProcess,
  status: ProjectProcessStatus | undefined,
  deps: ProcessCommandDeps
): Command => {
  const state = stateOf(status, entry.id);
  const live = liveEntry(status, entry.id);
  // The detected url first: a dev server that picked its own port knows where
  // it actually is, and the configured one is then a stale guess. Checking
  // live.url ahead of it never reached the detected value at all -- status
  // builds that field as `configuredUrl || detectedUrl`, so it is the
  // configured one whenever there is one.
  const url = live?.detectedUrl ?? live?.url ?? entry.url;

  const subtitles: Record<ProcessRowState, string> = {
    running: 'Running',
    failed: 'Failed',
    stopped: 'Stopped',
  };

  return {
    id: `process:${project.id}:${entry.id}`,
    title: entry.name,
    subtitle: subtitles[state],
    group: 'processes' as const,
    icon: state === 'running' ? Play : state === 'failed' ? AlertTriangle : Square,
    keywords: [
      entry.name,
      project.name,
      ...entry.commands,
      'start',
      'stop',
      'restart',
      'output',
      'logs',
    ],
    // A running process is the one you most often mean.
    priority: state === 'running' ? 1 : 0,
    // Enter does the obvious thing for the state the process is in -- except
    // while it is running, where there is no obvious thing.
    //
    // A stopped or crashed process has one sensible verb, and Enter does it. A
    // running one has several worth reaching for -- open its url, read its
    // output, restart it -- and stopping is merely the most destructive of
    // them. Binding Enter to Stop meant the key that opens a list everywhere
    // else in the palette killed a dev server here, on a row already showing
    // the chevron that promises a list.
    //
    // So a running row carries no `run` and Enter opens its actions, the same
    // way "Open in IDE" behaves with no preferred editor set: no single verb to
    // default to, so the choice is the action. Stop is the first row inside.
    //
    // A crashed one restarts rather than starts: it is still tracked, and
    // starting an id that is already tracked spawns nothing while reporting
    // success -- so a plain Start would look like the keypress did nothing.
    ...(state === 'running'
      ? { primaryActionLabel: 'View Actions' }
      : state === 'failed'
        ? {
            primaryActionLabel: 'Restart',
            run: (ctx: CommandContext) =>
              processAction(
                ctx,
                () => deps.restartProcess(project.id, entry.id),
                'restart',
                entry.name
              ),
          }
        : {
            primaryActionLabel: 'Start',
            run: (ctx: CommandContext) =>
              processAction(
                ctx,
                () => deps.startProcess(project.id, entry.id),
                'start',
                entry.name
              ),
          }),
    actions: () => processVerbs(project, entry, state, url, deps),
  };
};

/**
 * Every verb for one process, in the order they are most wanted.
 *
 * Start and Stop are both offered whatever the state: a level whose rows appear
 * and vanish as a process flips is one you cannot build muscle memory for. The
 * backend evicts a dead entry before spawning, so Start is correct from any
 * state.
 *
 * Which of the two leads does depend on the state, though. A running process's
 * Enter now opens this list rather than stopping outright, so Stop being the
 * first row is what keeps stopping a two-keystroke gesture -- and Start, which
 * would do nothing to a process already up, has no business sitting under the
 * cursor there.
 */
const processVerbs = (
  project: ProjectWithDetails,
  entry: StartProcess,
  state: ProcessRowState,
  url: string | undefined,
  deps: ProcessCommandDeps
): Command[] => {
  const base = `process.${project.id}:${entry.id}`;

  const start = {
    id: `${base}.start`,
    title: 'Start',
    subtitle: state === 'running' ? 'Already running' : undefined,
    group: 'processes' as const,
    icon: Play,
    primaryActionLabel: 'Start',
    run: (ctx: CommandContext) =>
      processAction(ctx, () => deps.startProcess(project.id, entry.id), 'start', entry.name),
  };

  const stop = {
    id: `${base}.stop`,
    title: 'Stop',
    group: 'processes' as const,
    icon: Square,
    primaryActionLabel: 'Stop',
    run: (ctx: CommandContext) =>
      processAction(ctx, () => deps.stopProcess(project.id, entry.id), 'stop', entry.name),
  };

  return [
    ...(state === 'running' ? [stop, start] : [start, stop]),
    {
      id: `${base}.restart`,
      title: 'Restart',
      group: 'processes' as const,
      icon: RotateCw,
      primaryActionLabel: 'Restart',
      keywords: ['reload', 'bounce'],
      run: (ctx: CommandContext) =>
        processAction(ctx, () => deps.restartProcess(project.id, entry.id), 'restart', entry.name),
    },
    // Only when there is somewhere to go. A row that cannot do its verb is
    // worse than an absent one in a list this short.
    ...(url
      ? [
          {
            id: `${base}.open-url`,
            title: 'Open URL',
            subtitle: url,
            group: 'processes' as const,
            icon: Link,
            primaryActionLabel: 'Open in Browser',
            keywords: ['browser', 'localhost'],
            run: async (ctx: CommandContext) => {
              await deps.openExternal(url);
              ctx.dismiss();
            },
          },
        ]
      : []),
    {
      id: `${base}.output`,
      title: 'View Output',
      group: 'processes' as const,
      icon: ScrollText,
      primaryActionLabel: 'View Output',
      keywords: ['logs', 'terminal', 'stdout'],
      // The only verb here that needs a window. From the floating palette
      // navigate raises or creates a main window; everything else above is a
      // plain HTTP call, which is the point of the global hotkey.
      run: (ctx: CommandContext) => ctx.navigate(`/projects/${project.id}/terminals`),
    },
  ];
};
