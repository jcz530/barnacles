import { describe, expect, it, vi } from 'vitest';
import { runCommand } from './run-command';
import type { Command, CommandContext } from './types';

const ctx = (): CommandContext => ({
  surface: 'in-app',
  navigate: vi.fn(),
  dismiss: vi.fn(),
  pop: vi.fn(),
  status: vi.fn(),
});

const command = (overrides: Partial<Command> = {}): Command => ({
  id: 'test.command',
  title: 'Test',
  group: 'app',
  ...overrides,
});

describe('runCommand', () => {
  it('runs the command with the context it was given', async () => {
    const run = vi.fn();
    const context = ctx();

    await runCommand(command({ run }), () => context);

    expect(run).toHaveBeenCalledWith(context);
  });

  it('does nothing for an item that carries actions instead of a verb', async () => {
    // Enter on such a row opens its level; there is nothing to run here.
    const build = vi.fn(ctx);

    await runCommand(command({ actions: () => [] }), build);

    expect(build).not.toHaveBeenCalled();
  });

  it('reports a command that throws rather than failing silently', async () => {
    // Without this the rejection is unhandled and the palette -- which now
    // stays open for these -- just sits there looking like the key missed.
    const context = ctx();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await runCommand(
      command({
        run: () => {
          throw new Error('boom');
        },
      }),
      () => context
    );

    expect(context.status).toHaveBeenCalledWith('Something went wrong', 'error');
    error.mockRestore();
  });

  it('catches a rejected promise, not just a synchronous throw', async () => {
    const context = ctx();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await runCommand(
      command({ run: () => Promise.reject(new Error('async boom')) }),
      () => context
    );

    expect(context.status).toHaveBeenCalledWith('Something went wrong', 'error');
    error.mockRestore();
  });

  it('leaves a command that reported its own failure to say it its way', async () => {
    // The backstop is for commands with no opinion. One that catches its own
    // failure says something specific -- "Could not kill port 3000" -- and must
    // not be second-guessed with a vaguer message on top.
    const context = ctx();

    await runCommand(
      command({
        run: c => {
          c.status('Could not kill port 3000', 'error');
        },
      }),
      () => context
    );

    expect(context.status).toHaveBeenCalledTimes(1);
    expect(context.status).toHaveBeenCalledWith('Could not kill port 3000', 'error');
  });

  it('builds the context once, so a command and its failure share one', async () => {
    // The catch reports through the same context the command was handed; a
    // second build could hand the message to a palette that has moved on.
    const build = vi.fn(ctx);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    await runCommand(command({ run: () => Promise.reject(new Error('boom')) }), build);

    expect(build).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
});
