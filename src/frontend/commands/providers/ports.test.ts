import { describe, expect, it, vi } from 'vitest';
import type { PortEntry } from '../../../shared/types/api';
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

describe('portCommands', () => {
  it('gives every command a unique id when one process holds several ports', () => {
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

  it('kills by pid even though the id carries the port', () => {
    const dependencies = deps();
    const commands = portCommands([entry({ pid: 42, port: 8080 })], dependencies);

    const kill = commands.find(command => command.id.startsWith('port.kill'));
    kill?.run({ surface: 'in-app', navigate: vi.fn(), dismiss: vi.fn() });

    expect(dependencies.killPort).toHaveBeenCalledWith(42);
  });
});
