import { describe, expect, it, vi } from 'vitest';
import { SETTING_KEYS } from '../../../shared/types/api';
import type { CommandContext } from '../types';
import { appCommands, type AppCommandDeps } from './app';

const deps = (overrides: Partial<AppCommandDeps> = {}): AppCommandDeps => ({
  rescanAll: vi.fn(),
  toggleTheme: vi.fn(),
  isDark: () => false,
  newWindow: vi.fn(),
  globalShortcutEnabled: false,
  ...overrides,
});

const ctx = (): CommandContext => ({
  surface: 'in-app',
  navigate: vi.fn(),
  dismiss: vi.fn(),
  pop: vi.fn(),
});

const find = (commands: ReturnType<typeof appCommands>, id: string) =>
  commands.find(command => command.id === id);

describe('appCommands', () => {
  it('offers to set up the global shortcut when it is off', () => {
    // It ships off, so most people never learn the palette has a "from
    // anywhere" half at all.
    expect(find(appCommands(deps()), 'app.enable-global-shortcut')).toBeDefined();
  });

  it('drops that row once the shortcut is on', () => {
    const commands = appCommands(deps({ globalShortcutEnabled: true }));

    expect(find(commands, 'app.enable-global-shortcut')).toBeUndefined();
  });

  it('sends the setup row to settings rather than toggling in place', () => {
    // The combo has to be chosen and the registration can fail against whatever
    // already owns it; neither has anywhere to live in a row that dismisses.
    const context = ctx();

    find(appCommands(deps()), 'app.enable-global-shortcut')?.run?.(context);

    expect(context.navigate).toHaveBeenCalledWith('/settings?setting=commandPaletteShortcut');
  });

  it('deep-links to the setting so the page scrolls to it', () => {
    // Settings runs long; landing at the top and hunting for the row is most of
    // the friction the row exists to remove. The page reads ?setting= and
    // scrolls to the matching data-setting, so the key has to be a real one.
    const context = ctx();

    find(appCommands(deps()), 'app.enable-global-shortcut')?.run?.(context);

    const path = vi.mocked(context.navigate).mock.calls[0][0] as string;
    const key = new URLSearchParams(path.split('?')[1]).get('setting');

    expect(Object.values(SETTING_KEYS)).toContain(key);
  });

  it('shows it before anything is typed', () => {
    expect(find(appCommands(deps()), 'app.enable-global-shortcut')?.priority).toBe(1);
  });
});
