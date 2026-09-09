import { describe, expect, it, vi } from 'vitest';
import type { DetectedIDE, DetectedTerminal, ProjectWithDetails } from '../../../shared/types/api';
import type { Command, CommandContext } from '../types';
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
  ...overrides,
});

const project = (overrides: Partial<ProjectWithDetails> = {}): ProjectWithDetails =>
  ({
    id: 'p1',
    name: 'Alchemy',
    path: '/Users/dev/alchemy',
    isFavorite: false,
    technologies: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as ProjectWithDetails;

const ctx = (): CommandContext => ({
  surface: 'in-app',
  navigate: vi.fn(),
  dismiss: vi.fn(),
  pop: vi.fn(),
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
});
