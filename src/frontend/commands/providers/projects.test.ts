import { describe, expect, it, vi } from 'vitest';
import type { DetectedIDE, DetectedTerminal, ProjectWithDetails } from '../../../shared/types/api';
import type { ProcessStatus, ProjectProcessStatus } from '../../../shared/types/process';
import type { Command, CommandContext } from '../types';
import { defaultCommands, levelDefaultItems } from '../ranking';
import { projectCommands, type ProjectCommandDeps } from './projects';

const ide = (id: string, name: string): DetectedIDE =>
  ({ id, name, installed: true }) as DetectedIDE;
const terminal = (id: string, name: string): DetectedTerminal =>
  ({ id, name, installed: true }) as DetectedTerminal;

const deps = (overrides: Partial<ProjectCommandDeps> = {}): ProjectCommandDeps => ({
  ides: [ide('cursor', 'Cursor'), ide('vscode', 'VS Code')],
  terminals: [terminal('ghostty', 'Ghostty'), terminal('iterm', 'iTerm2')],
  defaultIdeId: null,
  defaultTerminalId: null,
  openInIde: vi.fn(),
  openTerminal: vi.fn(),
  setPreferredIde: vi.fn(),
  setPreferredTerminal: vi.fn(),
  revealInFinder: vi.fn(),
  copyPath: vi.fn(),
  toggleFavorite: vi.fn().mockResolvedValue(true),
  gitProvider: (url?: string | null) =>
    url?.includes('github') ? { name: 'GitHub', webUrl: 'https://github.com/dev/alchemy' } : null,
  openExternal: vi.fn(),
  processStatuses: [],
  processState: { configured: {}, loading: {} },
  processDeps: {
    startProcesses: vi.fn(),
    stopProcesses: vi.fn(),
    startProcess: vi.fn(),
    stopProcess: vi.fn(),
    restartProcess: vi.fn(),
    openExternal: vi.fn(),
  },
  scriptState: { scripts: {}, loading: {} },
  scriptDeps: { runScript: vi.fn() },
  loadProcesses: vi.fn(),
  loadScripts: vi.fn(),
  ...overrides,
});

const project = (overrides: Partial<ProjectWithDetails> = {}): ProjectWithDetails =>
  ({
    id: 'p1',
    name: 'Alchemy',
    path: '/Users/dev/alchemy',
    isFavorite: false,
    technologies: [],
    hasStartProcesses: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as ProjectWithDetails;

const stats = (gitRemoteUrl: string): ProjectWithDetails['stats'] => ({
  id: 's1',
  projectId: 'p1',
  gitRemoteUrl,
});

/** A project's live status, with one running process by default. */
const running = (
  overrides: Partial<ProcessStatus> = {},
  projectId = 'p1'
): ProjectProcessStatus => ({
  projectId,
  processes: [
    {
      processId: 'proc1',
      name: 'dev',
      status: 'running',
      ...overrides,
    },
  ],
});

const ctx = (): CommandContext => ({
  surface: 'in-app',
  navigate: vi.fn(),
  dismiss: vi.fn(),
  pop: vi.fn(),
  status: vi.fn(),
});

const actionsOf = (command: Command) => command.actions?.(ctx()) ?? [];

const findAction = (command: Command, fragment: string) =>
  actionsOf(command).find(action => action.id.includes(fragment));

describe('projectCommands', () => {
  it('emits one row per project rather than one per verb', () => {
    // Five rows per project buried every other kind of result and got worse
    // with each project added.
    const commands = projectCommands([project(), project({ id: 'p2' })], deps());

    expect(commands).toHaveLength(2);
  });

  it('keeps the verbs findable from the project row', () => {
    // The verbs are no longer rows, so "barn ide" has to still match here.
    const [command] = projectCommands([project()], deps());

    expect(command.keywords).toEqual(expect.arrayContaining(['ide', 'terminal', 'finder']));
  });

  it('renders the project’s own icon, matching the projects page', () => {
    const [command] = projectCommands([project({ icon: 'icon.png' })], deps());

    expect(command.projectIcon).toEqual({
      projectId: 'p1',
      projectName: 'Alchemy',
      hasIcon: true,
    });
  });

  it('falls back to the folder glyph when a project has no icon', () => {
    const [command] = projectCommands([project({ icon: null })], deps());

    expect(command.projectIcon).toMatchObject({ hasIcon: false });
  });

  it('asks for the project’s processes and scripts as its level opens', () => {
    const dependencies = deps();
    const [command] = projectCommands([project()], dependencies);

    command.prepare?.();

    expect(dependencies.loadProcesses).toHaveBeenCalledWith('p1');
    expect(dependencies.loadScripts).toHaveBeenCalledWith('p1');
  });

  it('puts Run Script after the processes once its scripts are known', () => {
    const actions = actionsOf(
      projectCommands(
        [project()],
        deps({
          scriptState: {
            scripts: {
              p1: [
                {
                  source: 'npm',
                  relativeDir: '',
                  name: 'dev',
                  script: 'vite',
                  command: 'npm run dev',
                  manifest: 'NPM',
                },
              ],
            },
            loading: {},
          },
        })
      )[0]
    );

    expect(actions.at(-1)?.title).toBe('Run Script');
  });

  it('opens with the project’s own verbs before any process has loaded', () => {
    // The level must never be empty or blocked on a fetch: pushing an empty
    // level is refused, so the row would simply not respond.
    const actions = actionsOf(projectCommands([project()], deps())[0]);

    expect(actions.map(action => action.title)).toEqual([
      'Open Project',
      'Open in IDE',
      'Open Terminal',
      'Reveal in Finder',
      'View Stats',
      'Add to Favorites',
      'Copy Path',
    ]);
  });

  it('opens the stats page already filtered to the project', () => {
    // The same destination the project page's git card links to, so both land
    // on an identically scoped view.
    const context = ctx();
    const actions = actionsOf(projectCommands([project()], deps())[0]);
    const stats = actions.find(action => action.title === 'View Stats');

    stats?.run?.(context);

    expect(context.navigate).toHaveBeenCalledWith('/stats?projectId=p1');

    // Re-parsed rather than only string-matched, so a typo in the param name
    // cannot pass by looking approximately right.
    const path = vi.mocked(context.navigate).mock.calls[0][0];
    expect(new URLSearchParams(path.split('?')[1]).get('projectId')).toBe('p1');
  });

  it('offers stats for a project with no git remote', () => {
    // The stats page handles an empty history itself, and a row that appears
    // for only some projects is one you cannot build muscle memory for.
    const actions = actionsOf(projectCommands([project({ stats: null })], deps())[0]);

    expect(actions.some(action => action.title === 'View Stats')).toBe(true);
  });

  it('finds a project by the words for its stats', () => {
    // "alchemy stats" should reach the project, the way "alchemy ide" does.
    const [row] = projectCommands([project()], deps());

    expect(row.keywords).toEqual(expect.arrayContaining(['stats', 'commits']));
  });

  it('appends the processes beneath the project’s own verbs once loaded', () => {
    const actions = actionsOf(
      projectCommands(
        [project()],
        deps({
          processState: {
            configured: { p1: [{ id: 'web', name: 'web', commands: ['npm run dev'] }] },
            loading: {},
          },
        })
      )[0]
    );

    // Still led by the project's verbs, with the processes after them.
    expect(actions[0].title).toBe('Open Project');
    expect(actions.at(-1)?.id).toBe('process:p1:web');
  });

  it('builds its actions only when they are asked for', () => {
    const [command] = projectCommands([project()], deps());

    expect(typeof command.actions).toBe('function');
    expect(actionsOf(command).length).toBeGreaterThan(0);
  });
});

describe('opening a project’s tools', () => {
  it('names the preferred editor and opens it directly', () => {
    const [command] = projectCommands([project({ preferredIde: 'cursor' })], deps());
    const openIde = findAction(command, 'open-ide');

    expect(openIde?.title).toBe('Open in Cursor');
    expect(openIde?.run).toBeDefined();
  });

  it('uses the global default when the project has no preference of its own', () => {
    // The backend only reads the project's preference and throws otherwise, so
    // resolving here is what stops a global-default-only project failing.
    const [command] = projectCommands([project()], deps({ defaultIdeId: 'vscode' }));

    expect(findAction(command, 'open-ide')?.title).toBe('Open in VS Code');
  });

  it('stays findable by "ide" once its title names an editor instead', () => {
    // The row reads "Open in VS Code" as soon as a preference resolves, so the
    // word someone reaches for when they cannot remember which editor a
    // project uses had nothing left to match.
    const [command] = projectCommands([project({ preferredIde: 'vscode' })], deps());
    const openIde = findAction(command, 'open-ide');

    expect(openIde?.title).toBe('Open in VS Code');
    expect(openIde?.keywords).toEqual(expect.arrayContaining(['ide', 'editor', 'vs code']));
  });

  it('keeps the terminal row findable by "shell" the same way', () => {
    const [command] = projectCommands([project({ preferredTerminal: 'ghostty' })], deps());

    expect(findAction(command, 'open-terminal')?.keywords).toEqual(
      expect.arrayContaining(['terminal', 'shell'])
    );
  });

  it('offers the choice instead of guessing when nothing resolves', () => {
    // No run means Enter opens the picker -- there is nothing to default to.
    const [command] = projectCommands([project()], deps());
    const openIde = findAction(command, 'open-ide');

    expect(openIde?.title).toBe('Open in IDE');
    expect(openIde?.run).toBeUndefined();
    expect(openIde?.actions).toBeDefined();
  });

  it('passes the resolved tool id rather than relying on a backend fallback', async () => {
    const dependencies = deps({ defaultIdeId: 'vscode' });
    const [command] = projectCommands([project()], dependencies);

    await findAction(command, 'open-ide')?.run?.(ctx());

    expect(dependencies.openInIde).toHaveBeenCalledWith('p1', 'vscode');
  });

  it('lists every installed tool in the picker', () => {
    const [command] = projectCommands([project()], deps());
    const picker = findAction(command, 'open-terminal')?.actions?.(ctx()) ?? [];

    expect(picker.filter(action => action.id.includes('.pick:'))).toHaveLength(2);
  });

  it('opens the picked tool without changing the preference', async () => {
    // Reaching for a different editor once is far more common than wanting to
    // switch for good; silently rebinding would make the palette untrustworthy.
    const dependencies = deps();
    const [command] = projectCommands([project()], dependencies);
    const picker = findAction(command, 'open-ide')?.actions?.(ctx()) ?? [];
    const pick = picker.find(action => action.id.endsWith('.pick:vscode'));

    await pick?.run?.(ctx());

    expect(dependencies.openInIde).toHaveBeenCalledWith('p1', 'vscode');
    expect(dependencies.setPreferredIde).not.toHaveBeenCalled();
  });

  it('changes the preference only through its own action', async () => {
    const dependencies = deps();
    const [command] = projectCommands([project()], dependencies);
    const picker = findAction(command, 'open-ide')?.actions?.(ctx()) ?? [];
    const setDefault = picker.find(action => action.id.endsWith('.set-default:vscode'));
    const context = ctx();

    await setDefault?.run?.(context);

    expect(dependencies.setPreferredIde).toHaveBeenCalledWith('p1', 'vscode');
    expect(dependencies.openInIde).not.toHaveBeenCalled();
    // Back to the list rather than closing: setting a default is a step before
    // doing the thing, not the thing itself.
    expect(context.pop).toHaveBeenCalled();
    // Named, so the confirmation echoes the choice that was just made.
    expect(context.status).toHaveBeenCalledWith('VS Code is now the default for Alchemy');
  });

  it('separates setting a default from opening, so the level reads as two blocks', () => {
    const [command] = projectCommands([project()], deps());
    const picker = findAction(command, 'open-ide')?.actions?.(ctx()) ?? [];

    expect(picker.find(a => a.id.includes('.pick:'))?.group).toBe('projects');
    expect(picker.find(a => a.id.includes('.set-default:'))?.group).toBe('app');
  });

  it('falls through when the project prefers an uninstalled editor', () => {
    const [command] = projectCommands(
      [project({ preferredIde: 'sublime' })],
      deps({ defaultIdeId: 'vscode' })
    );

    expect(findAction(command, 'open-ide')?.title).toBe('Open in VS Code');
  });

  it('still offers the other actions when no tools are installed', () => {
    const [command] = projectCommands([project()], deps({ ides: [], terminals: [] }));

    expect(findAction(command, 'reveal')).toBeDefined();
    expect(findAction(command, 'copy-path')).toBeDefined();
  });

  describe('opening the project’s remote', () => {
    const onGithub = (): Partial<ProjectWithDetails> => ({
      stats: stats('git@github.com:dev/alchemy.git'),
    });

    it('names the provider rather than saying "remote"', () => {
      // The projects page's dropdown already says "View on GitHub"; naming the
      // same action differently here would read as a different one.
      const [command] = projectCommands([project(onGithub())], deps());

      expect(findAction(command, 'remote')?.title).toBe('View on GitHub');
    });

    it('offers nothing for a project with no remote', () => {
      // A local-only repo, or one whose stats have not been gathered. A row
      // that cannot do its verb is worse than an absent one.
      const [command] = projectCommands([project()], deps());

      expect(findAction(command, 'remote')).toBeUndefined();
    });

    it('opens the web url, not the ssh one it was derived from', async () => {
      const dependencies = deps();
      const [command] = projectCommands([project(onGithub())], dependencies);
      const context = ctx();

      await findAction(command, 'remote')?.run?.(context);

      expect(dependencies.openExternal).toHaveBeenCalledWith('https://github.com/dev/alchemy');
      // Closes, like the other verbs that hand off to another app.
      expect(context.dismiss).toHaveBeenCalled();
    });

    it('is found by the provider’s name as well as by "remote"', () => {
      const [command] = projectCommands([project(onGithub())], deps());

      expect(findAction(command, 'remote')?.keywords).toEqual(
        expect.arrayContaining(['github', 'remote', 'repo'])
      );
    });

    it('finds the project itself by its provider from the root list', () => {
      // "alchemy github" should reach the project, the way "alchemy ide" does.
      const [command] = projectCommands([project(onGithub())], deps());

      expect(command.keywords).toEqual(expect.arrayContaining(['github', 'remote']));
    });

    it('falls back to generic wording for an unrecognised host', () => {
      // The shared resolver returns "Other" for a domain it does not know --
      // a self-hosted GitLab, say. "View on Other" is not a sentence.
      const [command] = projectCommands(
        [project({ stats: stats('git@git.internal:dev/alchemy.git') })],
        deps({
          gitProvider: () => ({ name: 'Other', webUrl: 'https://git.internal/dev/alchemy' }),
        })
      );

      expect(findAction(command, 'remote')?.title).toBe('View Remote');
    });
  });

  describe('favouriting from the palette', () => {
    it('offers to add when the project is not a favourite', () => {
      const [command] = projectCommands([project({ isFavorite: false })], deps());

      expect(findAction(command, 'favorite')?.title).toBe('Add to Favorites');
    });

    it('offers to remove when it already is one', () => {
      // Named for what pressing it does, not for the state -- the row is a
      // verb like every other in the level.
      const [command] = projectCommands([project({ isFavorite: true })], deps());

      expect(findAction(command, 'favorite')?.title).toBe('Remove from Favorites');
    });

    it('stays open and confirms, so the row can be watched flipping', async () => {
      const dependencies = deps();
      const [command] = projectCommands([project({ isFavorite: false })], dependencies);
      const context = ctx();

      await findAction(command, 'favorite')?.run?.(context);

      expect(dependencies.toggleFavorite).toHaveBeenCalledWith('p1');
      expect(context.status).toHaveBeenCalledWith('Added Alchemy to favorites');
      expect(context.dismiss).not.toHaveBeenCalled();
    });

    it('reports what came back, not the state the row was built with', async () => {
      // The palette stays open, so pressing Enter twice runs the same closure
      // both times -- the row only rebuilds once a refetch lands. Reporting
      // from the captured isFavorite announced "Added" for the press that
      // removed it again.
      const dependencies = deps();
      vi.mocked(dependencies.toggleFavorite).mockResolvedValue(false);
      const [command] = projectCommands([project({ isFavorite: false })], dependencies);
      const context = ctx();

      await findAction(command, 'favorite')?.run?.(context);

      expect(context.status).toHaveBeenCalledWith('Removed Alchemy from favorites');
    });

    it('says so when the change does not stick', async () => {
      const dependencies = deps();
      vi.mocked(dependencies.toggleFavorite).mockRejectedValue(new Error('offline'));
      const [command] = projectCommands([project()], dependencies);
      const context = ctx();

      await findAction(command, 'favorite')?.run?.(context);

      expect(context.status).toHaveBeenCalledWith('Could not update favorites', 'error');
    });

    it('is reachable by typing the project name and "star"', () => {
      // The row is found through its project, not by a keyword standing on its
      // own: "star" alone would return every project at once.
      const [command] = projectCommands([project()], deps());

      expect(command.keywords).toEqual(expect.arrayContaining(['favorite', 'star']));
    });
  });

  describe('ranking the project being looked at', () => {
    it('puts the open project above favourites', () => {
      // Ranked rather than auto-opened: Cmd+K still lands at the root with an
      // empty box, and one Right arrow reaches this project's actions like any
      // other row's.
      const [current, favourite, plain] = projectCommands(
        [project({ id: 'p1' }), project({ id: 'p2', isFavorite: true }), project({ id: 'p3' })],
        deps({ currentProjectId: 'p1' })
      );

      expect(current.priority).toBeGreaterThan(favourite.priority ?? 0);
      expect(favourite.priority).toBeGreaterThan(plain.priority ?? 0);
    });

    it('outranks a favourite even when it is one itself', () => {
      const [command] = projectCommands(
        [project({ id: 'p1', isFavorite: true })],
        deps({ currentProjectId: 'p1' })
      );

      expect(command.priority).toBe(4);
    });

    it('ranks nothing specially away from a project page', () => {
      // The floating window has no router to ask, and neither does the
      // projects list -- both pass nothing and get the ordinary order.
      const [favourite, plain] = projectCommands(
        [project({ id: 'p1', isFavorite: true }), project({ id: 'p2' })],
        deps({ currentProjectId: null })
      );

      expect(favourite.priority).toBe(2);
      expect(plain.priority).toBe(0);
    });

    it('keeps the path as the subtitle rather than labelling the row', () => {
      // Two worktrees of one repo share a name; the path is what tells them
      // apart, and being first is signal enough on its own.
      const [command] = projectCommands(
        [project({ id: 'p1', path: '/Users/dev/alchemy' })],
        deps({ currentProjectId: 'p1' })
      );

      expect(command.subtitle).toBe('/Users/dev/alchemy');
    });
  });

  describe('copying a path', () => {
    it('stays open and confirms rather than closing', async () => {
      const [command] = projectCommands([project()], deps());
      const context = ctx();

      await findAction(command, 'copy-path')?.run?.(context);

      expect(context.status).toHaveBeenCalledWith('Copied /Users/dev/alchemy');
      expect(context.dismiss).not.toHaveBeenCalled();
    });

    it('keeps the end of a long path, which is the part that identifies it', async () => {
      const path = `/Users/dev/${'nested/'.repeat(12)}alchemy`;
      const [command] = projectCommands([project({ path })], deps());
      const context = ctx();

      await findAction(command, 'copy-path')?.run?.(context);

      const [message] = vi.mocked(context.status).mock.calls[0];
      expect(message).toContain('alchemy');
      expect(message.startsWith('Copied …')).toBe(true);
    });

    it('says so when the clipboard refuses', async () => {
      // The palette stays open for a copy, so a silent failure would look
      // exactly like a successful one.
      const dependencies = deps();
      vi.mocked(dependencies.copyPath).mockRejectedValue(new Error('denied'));
      const [command] = projectCommands([project()], dependencies);
      const context = ctx();

      await findAction(command, 'copy-path')?.run?.(context);

      expect(context.status).toHaveBeenCalledWith('Could not copy the path', 'error');
    });
  });

  it('points at settings when nothing is installed to open with', () => {
    // The alternative is a row whose list would be empty: pushing an empty
    // level is refused, so pressing Enter would appear to do nothing at all.
    const [command] = projectCommands([project()], deps({ ides: [] }));
    const openIde = findAction(command, 'open-ide');
    const context = ctx();

    expect(openIde?.subtitle).toBe('No editors detected');
    expect(openIde?.actions).toBeUndefined();

    openIde?.run?.(context);
    expect(context.navigate).toHaveBeenCalledWith('/settings');
  });
});

describe('a project that is running', () => {
  it('marks the row and says so in place of the path', () => {
    const [command] = projectCommands(
      [project()],
      deps({ processStatuses: [running({ detectedUrl: 'http://localhost:5173' })] })
    );

    expect(command.isRunning).toBe(true);
    expect(command.subtitle).toBe('Running · localhost:5173');
  });

  it('keeps the path when nothing is up', () => {
    const [command] = projectCommands([project()], deps());

    expect(command.isRunning).toBeFalsy();
    expect(command.subtitle).toBe('/Users/dev/alchemy');
  });

  it('counts the processes when only one of several announced an address', () => {
    // The shape that is ordinary rather than exceptional -- an api with a url
    // beside a database or a worker without one. Naming the api's address here
    // would invent exactly the primary process this is meant not to invent.
    const status: ProjectProcessStatus = {
      projectId: 'p1',
      processes: [
        { processId: 'api', name: 'api', status: 'running', detectedUrl: 'http://localhost:4000' },
        { processId: 'db', name: 'db', status: 'running' },
      ],
    };

    const [command] = projectCommands([project()], deps({ processStatuses: [status] }));

    expect(command.subtitle).toBe('Running · 2 processes');
  });

  it('counts the processes rather than picking one address', () => {
    // Three servers, and the first is not meaningfully the project's -- naming
    // it would invent a primary process the project never declared.
    const status: ProjectProcessStatus = {
      projectId: 'p1',
      processes: [
        { processId: 'api', name: 'api', status: 'running', detectedUrl: 'http://localhost:8080' },
        { processId: 'web', name: 'web', status: 'running', detectedUrl: 'http://localhost:5173' },
        { processId: 'jobs', name: 'jobs', status: 'running' },
      ],
    };

    const [command] = projectCommands([project()], deps({ processStatuses: [status] }));

    expect(command.subtitle).toBe('Running · 3 processes');
  });

  it('says only Running until a url is announced', () => {
    // A dev server takes a moment to print one, and a lone process with no
    // address has no count worth showing either.
    const [command] = projectCommands([project()], deps({ processStatuses: [running()] }));

    expect(command.subtitle).toBe('Running');
  });

  it('outranks a favourite but not the project being looked at', () => {
    const [live, favourite] = projectCommands(
      [project({ id: 'p1' }), project({ id: 'p2', isFavorite: true })],
      deps({ processStatuses: [running()] })
    );

    expect(live.priority).toBeGreaterThan(favourite.priority ?? 0);

    const [current] = projectCommands(
      [project({ id: 'p1' })],
      deps({ processStatuses: [running()], currentProjectId: 'p1' })
    );

    expect(current.priority).toBeGreaterThan(live.priority ?? 0);
  });

  it('forms a section of its own, so favorites keep their budget', () => {
    // Consolidating the old Stop rows onto the project row put running
    // projects and favorites in one group capped at five, and running
    // outranks favorite -- so four running projects left room for exactly one
    // favorite in the empty list.
    const projects = [
      ...[1, 2, 3, 4].map(i => project({ id: `r${i}`, name: `running${i}` })),
      ...[1, 2, 3, 4, 5, 6].map(i => project({ id: `f${i}`, name: `fav${i}`, isFavorite: true })),
    ];
    const statuses = [1, 2, 3, 4].map(i => running({}, `r${i}`));

    const grouped = defaultCommands(projectCommands(projects, deps({ processStatuses: statuses })));

    expect(grouped.map(group => group.label)).toEqual(['Running', 'Projects']);
    expect(grouped[0].commands).toHaveLength(4);
    expect(grouped[1].commands.map(row => row.title)).toEqual([
      'fav1',
      'fav2',
      'fav3',
      'fav4',
      'fav5',
    ]);
  });

  it('labels the section only while running, and only for the label', () => {
    // The group id stays 'projects', so a search still ranks these against the
    // other project rows -- it is the empty list this is about.
    const [live] = projectCommands([project()], deps({ processStatuses: [running()] }));
    const [idle] = projectCommands([project()], deps());

    expect(live.groupLabel).toBe('Running');
    expect(live.group).toBe('projects');
    expect(idle.groupLabel).toBeUndefined();
  });

  it('answers a search for the verb its root row no longer carries', () => {
    // Stop left the root list, so the word has to find the project whose level
    // does the stopping.
    const [command] = projectCommands([project()], deps({ processStatuses: [running()] }));

    expect(command.keywords).toContain('stop');
    expect(command.keywords).toContain('running');
  });

  it('does not answer that search while stopped', () => {
    const [command] = projectCommands([project()], deps());

    expect(command.keywords).not.toContain('stop');
  });
});

describe('opening a running url from the project level', () => {
  it('offers the address, ahead of the editor', () => {
    const [command] = projectCommands(
      [project()],
      deps({ processStatuses: [running({ detectedUrl: 'http://localhost:5173' })] })
    );

    const url = findAction(command, 'project.open-url');

    expect(url?.title).toBe('Open localhost:5173');
    expect(url?.subtitle).toBe('http://localhost:5173');

    // Asserted through the ranking rather than on the raw array, because the
    // array is not what anybody sees: levelDefaultItems re-sorts before render,
    // so an assertion on index order can hold while the rendered list disagrees.
    const rendered = levelDefaultItems(actionsOf(command));
    const projectRows = rendered.find(group => group.label === 'Projects')?.commands ?? [];
    const titles = projectRows.map(row => row.title);

    expect(titles.indexOf('Open localhost:5173')).toBeLessThan(titles.indexOf('Open in IDE'));
  });

  it('opens it in a browser and closes', async () => {
    const dependencies = deps({
      processStatuses: [running({ detectedUrl: 'http://localhost:5173' })],
    });
    const [command] = projectCommands([project()], dependencies);
    const context = ctx();

    await findAction(command, 'project.open-url')?.run?.(context);

    expect(dependencies.openExternal).toHaveBeenCalledWith('http://localhost:5173');
    expect(context.dismiss).toHaveBeenCalled();
  });

  it('names each process when several are up', () => {
    const status: ProjectProcessStatus = {
      projectId: 'p1',
      processes: [
        { processId: 'api', name: 'api', status: 'running', detectedUrl: 'http://localhost:8080' },
        { processId: 'web', name: 'web', status: 'running', detectedUrl: 'http://localhost:5173' },
      ],
    };

    const [command] = projectCommands([project()], deps({ processStatuses: [status] }));
    const rows = actionsOf(command).filter(action => action.id.includes('project.open-url'));

    expect(rows.map(row => row.title)).toEqual(['Open localhost:8080', 'Open localhost:5173']);
    // The address is already the title, so the name is what tells them apart.
    expect(rows.map(row => row.subtitle)).toEqual(['api', 'web']);
  });

  it('offers nothing for a process that has not announced an address', () => {
    const [command] = projectCommands([project()], deps({ processStatuses: [running()] }));

    expect(findAction(command, 'project.open-url')).toBeUndefined();
  });

  it('offers nothing at all while stopped', () => {
    // Built from live status, so a stopped project has no row pointing at a
    // port that is no longer answering.
    const stopped: ProjectProcessStatus = {
      projectId: 'p1',
      processes: [
        { processId: 'proc1', name: 'dev', status: 'stopped', url: 'http://localhost:5173' },
      ],
    };

    const [command] = projectCommands([project()], deps({ processStatuses: [stopped] }));

    expect(findAction(command, 'project.open-url')).toBeUndefined();
  });

  it('prefers the address the server actually picked', () => {
    // A configured url is a guess; the detected one is where it ended up.
    const [command] = projectCommands(
      [project()],
      deps({
        processStatuses: [
          running({ url: 'http://localhost:3000', detectedUrl: 'http://localhost:5174' }),
        ],
      })
    );

    expect(findAction(command, 'project.open-url')?.title).toBe('Open localhost:5174');
  });

  it('falls back to the configured url when nothing was detected', () => {
    const [command] = projectCommands(
      [project()],
      deps({
        processStatuses: [running({ url: 'http://localhost:3000' })],
        processState: {
          configured: {
            p1: [{ id: 'proc1', name: 'dev', commands: ['npm run dev'] }],
          },
          loading: {},
        },
      })
    );

    expect(findAction(command, 'project.open-url')?.title).toBe('Open localhost:3000');
  });
});
