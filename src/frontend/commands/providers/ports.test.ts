import { describe, expect, it, vi } from 'vitest';
import type { PortEntry } from '../../../shared/types/api';
import type { Command, CommandContext } from '../types';
import { portCommands } from './ports';

const deps = () => ({
  killPort: vi.fn(),
  copyText: vi.fn(),
  openExternal: vi.fn(),
});

const entry = (overrides: Partial<PortEntry> = {}): PortEntry => ({
  pid: 1234,
  port: 3000,
  protocol: 'TCP',
  processName: 'node',
  state: 'LISTEN',
  ...overrides,
});

const ctx = (): CommandContext => ({
  surface: 'in-app',
  navigate: vi.fn(),
  dismiss: vi.fn(),
  pop: vi.fn(),
  status: vi.fn(),
});

const actionsOf = (command: Command) => command.actions?.(ctx()) ?? [];

describe('portCommands', () => {
  it('emits one row per port rather than one per verb', () => {
    const commands = portCommands([entry(), entry({ port: 3001 })], deps());

    expect(commands).toHaveLength(2);
  });

  it('gives every row a unique id when one process holds several ports', () => {
    // Routine: a server bound to both IPv4 and IPv6, or a dev server alongside
    // its HMR socket. Keying on pid alone collided, which surfaced as duplicate
    // Vue render keys.
    const commands = portCommands(
      [entry({ pid: 1234, port: 3000 }), entry({ pid: 1234, port: 3001 })],
      deps()
    );

    const ids = commands.map(command => command.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('opens the port in a browser on Enter', () => {
    const dependencies = deps();
    const [command] = portCommands([entry({ port: 8080 })], dependencies);

    command.run?.(ctx());

    expect(dependencies.openExternal).toHaveBeenCalledWith('http://localhost:8080');
  });

  it('keeps killing behind the actions rather than on the row', () => {
    // Destructive, and as a top-level row it sat one Enter away from a fuzzy
    // match on a number.
    const [command] = portCommands([entry()], deps());

    expect(command.id).not.toContain('kill');
    expect(actionsOf(command).some(action => action.id.includes('kill'))).toBe(true);
  });

  it('keeps the verbs findable from the port row', () => {
    const [command] = portCommands([entry({ port: 3000 })], deps());

    expect(command.keywords).toEqual(expect.arrayContaining(['3000', 'kill', 'localhost']));
  });

  it('kills by pid even though the id carries the port', async () => {
    const dependencies = deps();
    const [command] = portCommands([entry({ pid: 42, port: 8080 })], dependencies);
    const kill = actionsOf(command).find(action => action.id.startsWith('port.kill'));

    await kill?.run?.(ctx());

    expect(dependencies.killPort).toHaveBeenCalledWith(42);
  });

  it('copies the number and the url separately', async () => {
    const dependencies = deps();
    const [command] = portCommands([entry({ port: 5173 })], dependencies);
    const actions = actionsOf(command);

    await actions.find(a => a.id.startsWith('port.copy:'))?.run?.(ctx());
    await actions.find(a => a.id.startsWith('port.copy-url:'))?.run?.(ctx());

    expect(dependencies.copyText).toHaveBeenNthCalledWith(1, '5173');
    expect(dependencies.copyText).toHaveBeenNthCalledWith(2, 'http://localhost:5173');
  });

  describe('acting on a port', () => {
    const portActions = (dependencies: ReturnType<typeof deps>) =>
      actionsOf(portCommands([entry({ port: 5173 })], dependencies)[0]);

    it('stays open and confirms, rather than closing on a copy', async () => {
      // Nothing on screen changes when you copy, so a palette that closes
      // leaves no evidence the copy happened at all.
      const dependencies = deps();
      const context = ctx();

      await portActions(dependencies)
        .find(a => a.id.startsWith('port.copy:'))
        ?.run?.(context);

      expect(context.status).toHaveBeenCalledWith('Copied 5173');
      expect(context.dismiss).not.toHaveBeenCalled();
    });

    it('says so when the clipboard refuses', async () => {
      const dependencies = deps();
      dependencies.copyText.mockRejectedValue(new Error('denied'));
      const context = ctx();

      await portActions(dependencies)
        .find(a => a.id.startsWith('port.copy-url:'))
        ?.run?.(context);

      expect(context.status).toHaveBeenCalledWith('Could not copy http://localhost:5173', 'error');
    });

    it('stays open on a kill, so the row can be watched leaving', async () => {
      // The level this runs from collapses as the port disappears -- its
      // subject is gone -- which is exactly why the status line does not clear
      // on a level change. See useCommandStatus.
      const dependencies = deps();
      const context = ctx();

      await portActions(dependencies)
        .find(a => a.id.startsWith('port.kill:'))
        ?.run?.(context);

      expect(context.status).toHaveBeenCalledWith('Killed port 5173');
      expect(context.dismiss).not.toHaveBeenCalled();
    });

    it('says so when a port refuses to die', async () => {
      // A process owned by another user, or one that outlives the signal.
      // Silence here would read as the keypress having been ignored.
      const dependencies = deps();
      dependencies.killPort.mockRejectedValue(new Error('EPERM'));
      const context = ctx();

      await portActions(dependencies)
        .find(a => a.id.startsWith('port.kill:'))
        ?.run?.(context);

      expect(context.status).toHaveBeenCalledWith('Could not kill port 5173', 'error');
    });

    it('still closes when opening the port in a browser', async () => {
      // The browser takes focus, so the floating palette is hidden by its own
      // blur handler regardless -- staying open would be a promise it cannot keep.
      const dependencies = deps();
      const context = ctx();

      await portActions(dependencies)
        .find(a => a.id.startsWith('port.open:'))
        ?.run?.(context);

      expect(context.dismiss).toHaveBeenCalled();
    });
  });

  it('gives every action a unique id across ports of one process', () => {
    const commands = portCommands(
      [entry({ pid: 1234, port: 3000 }), entry({ pid: 1234, port: 3001 })],
      deps()
    );

    const ids = commands.flatMap(command => actionsOf(command).map(action => action.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
