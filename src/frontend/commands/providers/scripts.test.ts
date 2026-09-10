import { describe, expect, it, vi } from 'vitest';
import type { ProjectWithDetails } from '../../../shared/types/api';
import type { RunnableScript } from '../../../shared/types/process';
import type { Command, CommandContext } from '../types';
import { scriptCommands, type ScriptCommandDeps, type ScriptCommandState } from './scripts';

const deps = (overrides: Partial<ScriptCommandDeps> = {}): ScriptCommandDeps => ({
  runScript: vi.fn(),
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

const script = (overrides: Partial<RunnableScript> = {}): RunnableScript => ({
  source: 'npm',
  relativeDir: '',
  name: 'dev',
  script: 'vite',
  command: 'npm run dev',
  manifest: 'NPM',
  ...overrides,
});

const unknown = (): ScriptCommandState => ({ scripts: {}, loading: {} });
const loaded = (scripts: RunnableScript[], projectId = 'p1'): ScriptCommandState => ({
  scripts: { [projectId]: scripts },
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

describe('scriptCommands', () => {
  it('offers nothing before anything has been asked for', () => {
    expect(scriptCommands(project(), unknown(), deps())).toEqual([]);
  });

  it('shows a placeholder while the fetch is in flight', () => {
    const state: ScriptCommandState = { scripts: {}, loading: { p1: true } };

    const [row] = scriptCommands(project(), state, deps());

    expect(row.loading).toBe(true);
    expect(row.run).toBeUndefined();
  });

  it('offers nothing for a project whose manifests have no scripts', () => {
    expect(scriptCommands(project(), loaded([]), deps())).toEqual([]);
  });

  it('collapses the scripts behind one row rather than listing them inline', () => {
    // A project routinely has twenty-odd scripts; inlining them would bury the
    // processes someone actually came for.
    const commands = scriptCommands(
      project(),
      loaded([script(), script({ name: 'build', command: 'npm run build' })]),
      deps()
    );

    expect(commands).toHaveLength(1);
    expect(commands[0].title).toBe('Run Script');
    expect(commands[0].subtitle).toBe('2 scripts');
  });

  it('counts a single script in the singular', () => {
    const [row] = scriptCommands(project(), loaded([script()]), deps());

    expect(row.subtitle).toBe('1 script');
  });

  it('opens the choice on Enter rather than guessing a script', () => {
    const [row] = scriptCommands(project(), loaded([script()]), deps());

    expect(row.run).toBeUndefined();
    expect(row.actions).toBeDefined();
  });

  it('lists one action per script, showing what each one runs', () => {
    const [row] = scriptCommands(
      project(),
      loaded([script(), script({ name: 'build', script: 'vite build', command: 'npm run build' })]),
      deps()
    );

    const actions = actionsOf(row);

    expect(actions.map(action => action.title)).toEqual(['dev', 'build']);
    expect(actions[1].subtitle).toBe('vite build');
  });

  it('groups each script under the manifest it came from', () => {
    // Forty scripts in one flat list is unreadable, and a workspace's `build`
    // has to be tellable from the root's.
    const [row] = scriptCommands(
      project(),
      loaded([
        script({ name: 'build', command: 'pnpm build', manifest: 'PNPM' }),
        script({
          relativeDir: 'api',
          name: 'build',
          command: 'npm run build',
          manifest: 'api/package.json',
        }),
        script({ source: 'composer', name: 'test', manifest: 'Composer' }),
      ]),
      deps()
    );

    expect(actionsOf(row).map(action => action.groupLabel)).toEqual([
      'PNPM Scripts',
      'api/package.json Scripts',
      'Composer Scripts',
    ]);
  });

  it('shows the bare script name, leaving the manifest to the heading', () => {
    const [row] = scriptCommands(
      project(),
      loaded([script({ relativeDir: 'api', name: 'build', manifest: 'api/package.json' })]),
      deps()
    );

    expect(actionsOf(row)[0].title).toBe('build');
  });

  it('stacks a script body under its name rather than beside it', () => {
    // Bodies run to hundreds of characters; opposite the name they leave
    // nothing of the name.
    const [row] = scriptCommands(project(), loaded([script()]), deps());

    expect(actionsOf(row)[0].stackSubtitle).toBe(true);
  });

  it('keeps ids unique when a name repeats across directories and manifests', () => {
    const [row] = scriptCommands(
      project(),
      loaded([
        script({ name: 'test' }),
        script({ relativeDir: 'api', name: 'test' }),
        script({ source: 'composer', name: 'test', command: 'composer run-script test' }),
      ]),
      deps()
    );

    const ids = actionsOf(row).map(action => action.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('runs a root script in the project directory', async () => {
    const dependencies = deps();
    const [row] = scriptCommands(project(), loaded([script()]), dependencies);

    await actionsOf(row)[0].run?.(ctx());

    expect(dependencies.runScript).toHaveBeenCalledWith('p1', '/Users/dev/alchemy', 'npm run dev');
  });

  it('runs a workspace script in its own directory', async () => {
    const dependencies = deps();
    const [row] = scriptCommands(
      project(),
      loaded([script({ relativeDir: 'api', name: 'build', command: 'npm run build' })]),
      dependencies
    );

    await actionsOf(row)[0].run?.(ctx());

    expect(dependencies.runScript).toHaveBeenCalledWith(
      'p1',
      '/Users/dev/alchemy/api',
      'npm run build'
    );
  });

  it('uses the command the server resolved rather than assembling its own', async () => {
    // The package manager is a per-directory question the server has already
    // answered; rebuilding the command here would be a second place to get it
    // wrong.
    const dependencies = deps();
    const [row] = scriptCommands(
      project(),
      loaded([script({ command: 'pnpm dev' })]),
      dependencies
    );

    await actionsOf(row)[0].run?.(ctx());

    expect(dependencies.runScript).toHaveBeenCalledWith('p1', '/Users/dev/alchemy', 'pnpm dev');
  });

  describe('reporting the run', () => {
    it('stays open, so several scripts can be started in a row', async () => {
      const [row] = scriptCommands(project(), loaded([script({ name: 'dev' })]), deps());
      const context = ctx();

      await actionsOf(row)[0].run?.(context);

      expect(context.status).toHaveBeenCalledWith('Started dev');
      expect(context.dismiss).not.toHaveBeenCalled();
    });

    it('says so when a script will not start', async () => {
      const dependencies = deps();
      vi.mocked(dependencies.runScript).mockRejectedValue(new Error('spawn failed'));
      const [row] = scriptCommands(project(), loaded([script({ name: 'dev' })]), dependencies);
      const context = ctx();

      await actionsOf(row)[0].run?.(context);

      expect(context.status).toHaveBeenCalledWith('Could not start dev', 'error');
    });
  });
});
