import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A fake IPty that captures the handlers the service registers, so a test can
 * drive output and exit without spawning a real shell.
 */
interface FakePty {
  pid: number;
  emitData: (chunk: string) => void;
  emitExit: (exitCode: number) => void;
  write: ReturnType<typeof vi.fn>;
  resize: ReturnType<typeof vi.fn>;
  kill: ReturnType<typeof vi.fn>;
  onData: (cb: (data: string) => void) => void;
  onExit: (cb: (e: { exitCode: number }) => void) => void;
}

/** Every pty handed out by the mocked node-pty, newest last. */
const spawned: FakePty[] = [];

function createFakePty(): FakePty {
  let dataCb: ((data: string) => void) | undefined;
  let exitCb: ((e: { exitCode: number }) => void) | undefined;

  return {
    pid: 1234,
    onData: cb => {
      dataCb = cb;
    },
    onExit: cb => {
      exitCb = cb;
    },
    emitData: chunk => dataCb?.(chunk),
    emitExit: exitCode => exitCb?.({ exitCode }),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
  };
}

vi.mock('node-pty', () => ({
  spawn: vi.fn(() => {
    const pty = createFakePty();
    spawned.push(pty);
    return pty;
  }),
}));

// The service reads $SHELL/platform helpers at spawn time; pin them so the
// suite behaves identically on every developer's machine and in CI.
vi.mock('@shared/utils/platform', () => ({
  isWindows: false,
  getDefaultShell: () => '/bin/bash',
}));

const { ProcessManagerService } = await import('@backend/services/process-manager-service');

type Service = InstanceType<typeof ProcessManagerService>;

/** The most recently spawned pty. */
function lastPty(): FakePty {
  const pty = spawned.at(-1);
  if (!pty) {
    throw new Error('no pty was spawned');
  }
  return pty;
}

/** Start one configured project process and return its id plus its pty. */
async function startOne(
  service: Service,
  overrides: { id?: string; url?: string; name?: string } = {}
): Promise<{ processId: string; pty: FakePty }> {
  const processId = overrides.id ?? 'proc-1';
  await service.startProjectProcesses('project-1', '/tmp/project', [
    {
      id: processId,
      name: overrides.name ?? 'dev',
      commands: ['npm run dev'],
      url: overrides.url,
      order: 0,
    } as never,
  ]);
  return { processId, pty: lastPty() };
}

describe('ProcessManagerService', () => {
  let service: Service;

  beforeEach(() => {
    spawned.length = 0;
    service = new ProcessManagerService();
    vi.restoreAllMocks();
  });

  describe('output buffering', () => {
    it('accumulates pty output in order', async () => {
      const { processId, pty } = await startOne(service);

      pty.emitData('first\r\n');
      pty.emitData('second\r\n');

      expect(service.getProcessOutputById(processId)).toEqual(['first\r\n', 'second\r\n']);
    });

    it('caps the buffer at 1000 chunks, keeping the most recent', async () => {
      const { processId, pty } = await startOne(service);

      for (let i = 0; i < 1005; i++) {
        pty.emitData(`chunk-${i}`);
      }

      const output = service.getProcessOutputById(processId)!;
      expect(output).toHaveLength(1000);
      // The five oldest chunks were evicted.
      expect(output[0]).toBe('chunk-5');
      expect(output.at(-1)).toBe('chunk-1004');
    });

    it('buffers ad-hoc process output the same way', async () => {
      const created = await service.createProcess({
        projectId: 'project-1',
        cwd: '/tmp/project',
        command: 'npm test',
        title: 'tests',
      });

      lastPty().emitData('running tests\r\n');

      expect(service.getProcessOutputById(created.processId)).toEqual(['running tests\r\n']);
    });
  });

  describe('URL detection', () => {
    it('detects a URL from output when none is configured', async () => {
      const { processId, pty } = await startOne(service);

      pty.emitData('  ➜  Local:   http://localhost:5173/\r\n');

      expect(service.getProcess(processId)?.url).toBe('http://localhost:5173/');
    });

    it('does not override a configured URL with a detected one', async () => {
      // The configured URL is the user's explicit choice, so a banner printed by
      // the dev server must not win over it.
      const { processId, pty } = await startOne(service, { url: 'http://configured.test' });

      pty.emitData('  ➜  Local:   http://localhost:5173/\r\n');

      expect(service.getProcess(processId)?.url).toBe('http://configured.test');
    });

    it('detects a URL for ad-hoc processes, which have no configured URL', async () => {
      const created = await service.createProcess({
        projectId: 'project-1',
        cwd: '/tmp/project',
        command: 'npm run dev',
        title: 'dev',
      });

      lastPty().emitData('Listening at http://localhost:3000\r\n');

      expect(service.getProcess(created.processId)?.url).toBe('http://localhost:3000');
    });
  });

  describe('exit handling', () => {
    it('marks a zero exit as stopped', async () => {
      const { processId, pty } = await startOne(service);

      pty.emitExit(0);

      const status = service.getProcess(processId);
      expect(status?.status).toBe('stopped');
      expect(status?.exitCode).toBe(0);
    });

    it('marks a non-zero exit as failed', async () => {
      const { processId, pty } = await startOne(service);

      pty.emitExit(1);

      const status = service.getProcess(processId);
      expect(status?.status).toBe('failed');
      expect(status?.exitCode).toBe(1);
    });

    it('keeps output readable after the process exits', async () => {
      // Output outlives the process so a failed run can still be inspected.
      const { processId, pty } = await startOne(service);

      pty.emitData('boom\r\n');
      pty.emitExit(1);

      expect(service.getProcessOutputById(processId)).toEqual(['boom\r\n']);
    });
  });

  describe('subscribe', () => {
    it('hands back the buffered scrollback and a disposer', async () => {
      const { processId, pty } = await startOne(service);
      pty.emitData('before\r\n');

      const sub = service.subscribe(processId, { onData: vi.fn(), onExit: vi.fn() })!;

      expect(sub.snapshot).toEqual(['before\r\n']);
      expect(sub.seq).toBe(1);
      expect(typeof sub.unsubscribe).toBe('function');
    });

    it('returns a copy, so a caller cannot mutate the live buffer', async () => {
      const { processId, pty } = await startOne(service);
      pty.emitData('one');

      const sub = service.subscribe(processId, { onData: vi.fn(), onExit: vi.fn() })!;
      sub.snapshot.push('injected');

      expect(service.getProcessOutputById(processId)).toEqual(['one']);
    });

    it('delivers chunks after subscribing, with a contiguous seq', async () => {
      const { processId, pty } = await startOne(service);
      const onData = vi.fn();
      service.subscribe(processId, { onData, onExit: vi.fn() });

      pty.emitData('a');
      pty.emitData('b');

      expect(onData.mock.calls).toEqual([
        ['a', 1],
        ['b', 2],
      ]);
    });

    it('replays a chunk exactly once across the subscribe boundary', async () => {
      // The bug this guards: if the snapshot and the subscription were not
      // taken together, a chunk arriving between them would either be painted
      // twice or lost entirely.
      const { processId, pty } = await startOne(service);
      pty.emitData('historical');

      const onData = vi.fn();
      const sub = service.subscribe(processId, { onData, onExit: vi.fn() })!;

      expect(sub.snapshot).toEqual(['historical']);
      expect(onData).not.toHaveBeenCalled();

      pty.emitData('live');
      expect(onData.mock.calls).toEqual([['live', 2]]);
    });

    it('stops delivering after the disposer runs', async () => {
      const { processId, pty } = await startOne(service);
      const onData = vi.fn();
      const sub = service.subscribe(processId, { onData, onExit: vi.fn() })!;

      sub.unsubscribe();
      pty.emitData('ignored');

      expect(onData).not.toHaveBeenCalled();
    });

    it('fans out to every subscriber', async () => {
      const { processId, pty } = await startOne(service);
      const first = vi.fn();
      const second = vi.fn();
      service.subscribe(processId, { onData: first, onExit: vi.fn() });
      service.subscribe(processId, { onData: second, onExit: vi.fn() });

      pty.emitData('shared');

      expect(first).toHaveBeenCalledWith('shared', 1);
      expect(second).toHaveBeenCalledWith('shared', 1);
    });

    it('keeps serving other subscribers when one throws', async () => {
      const { processId, pty } = await startOne(service);
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const healthy = vi.fn();
      service.subscribe(processId, {
        onData: () => {
          throw new Error('bad consumer');
        },
        onExit: vi.fn(),
      });
      service.subscribe(processId, { onData: healthy, onExit: vi.fn() });

      pty.emitData('still delivered');

      expect(healthy).toHaveBeenCalledWith('still delivered', 1);
      expect(service.getProcessOutputById(processId)).toEqual(['still delivered']);
    });

    it('notifies subscribers on exit', async () => {
      const { processId, pty } = await startOne(service);
      const onExit = vi.fn();
      service.subscribe(processId, { onData: vi.fn(), onExit });

      pty.emitExit(3);

      expect(onExit).toHaveBeenCalledWith(3);
    });

    it('keeps counting seq past a buffer eviction', async () => {
      // seq tracks chunks produced, not chunks retained, so a client can still
      // tell that it missed something after the ring buffer wraps.
      const { processId, pty } = await startOne(service);
      for (let i = 0; i < 1005; i++) {
        pty.emitData(`c${i}`);
      }

      const sub = service.subscribe(processId, { onData: vi.fn(), onExit: vi.fn() })!;

      expect(sub.seq).toBe(1005);
      expect(sub.snapshot).toHaveLength(1000);
    });

    it('returns null for an unknown process', () => {
      expect(service.subscribe('nope', { onData: vi.fn(), onExit: vi.fn() })).toBeNull();
    });
  });

  describe('writeToProcess', () => {
    it('forwards input to the pty', async () => {
      const { processId, pty } = await startOne(service);

      expect(service.writeToProcess(processId, 'ls\r')).toBe(true);
      expect(pty.write).toHaveBeenCalledWith('ls\r');
    });

    it('truncates an oversized frame rather than passing it through', async () => {
      const { processId, pty } = await startOne(service);

      service.writeToProcess(processId, 'x'.repeat(10_000));

      expect(pty.write.mock.calls[0][0]).toHaveLength(8 * 1024);
    });

    it('refuses to write to an exited process', async () => {
      const { processId, pty } = await startOne(service);
      pty.emitExit(0);

      expect(service.writeToProcess(processId, 'ls\r')).toBe(false);
      expect(pty.write).not.toHaveBeenCalled();
    });

    it('returns false for an unknown process', () => {
      expect(service.writeToProcess('nope', 'ls')).toBe(false);
    });

    it('survives a throwing pty', async () => {
      const { processId, pty } = await startOne(service);
      vi.spyOn(console, 'error').mockImplementation(() => {});
      pty.write.mockImplementation(() => {
        throw new Error('pty gone');
      });

      expect(service.writeToProcess(processId, 'ls')).toBe(false);
    });
  });

  describe('input truncation', () => {
    it('does not split a surrogate pair at the cap', async () => {
      // Slicing mid-pair would write half a character to the PTY.
      const { processId, pty } = await startOne(service);
      const cap = 8 * 1024;
      // Land an emoji (two code units) exactly astride the boundary.
      const data = 'a'.repeat(cap - 1) + '😀' + 'b'.repeat(10);

      service.writeToProcess(processId, data);

      const written = pty.write.mock.calls[0][0] as string;
      expect(written).toHaveLength(cap - 1);
      const lastCode = written.charCodeAt(written.length - 1);
      expect(lastCode >= 0xd800 && lastCode <= 0xdbff).toBe(false);
    });
  });

  describe('resizeProcess', () => {
    it('resizes the pty and records the new geometry', async () => {
      const { processId, pty } = await startOne(service);

      expect(service.resizeProcess(processId, 100, 40)).toBe(true);
      expect(pty.resize).toHaveBeenCalledWith(100, 40);
      expect(service.getProcessSnapshot(processId)).toMatchObject({ cols: 100, rows: 40 });
    });

    it.each([
      ['zero cols', 0, 24],
      ['negative rows', 80, -1],
      ['fractional cols', 80.5, 24],
      ['absurd width', 100_000, 24],
      ['NaN', Number.NaN, 24],
    ])('rejects %s without touching the pty', async (_label, cols, rows) => {
      const { processId, pty } = await startOne(service);

      expect(service.resizeProcess(processId, cols, rows)).toBe(false);
      expect(pty.resize).not.toHaveBeenCalled();
    });

    it('survives a throwing pty', async () => {
      const { processId, pty } = await startOne(service);
      vi.spyOn(console, 'error').mockImplementation(() => {});
      pty.resize.mockImplementation(() => {
        throw new Error('pty gone');
      });

      expect(service.resizeProcess(processId, 100, 40)).toBe(false);
    });
  });

  describe('getProcessSnapshot', () => {
    it('reports buffered output, seq, status, and geometry', async () => {
      const { processId, pty } = await startOne(service);
      pty.emitData('hello');

      expect(service.getProcessSnapshot(processId)).toEqual({
        output: ['hello'],
        seq: 1,
        status: 'running',
        exitCode: undefined,
        cols: 80,
        rows: 24,
      });
    });

    it('returns null for an unknown process', () => {
      expect(service.getProcessSnapshot('nope')).toBeNull();
    });
  });

  describe('lookup by id', () => {
    it('finds a process across projects', async () => {
      await service.startProjectProcesses('project-a', '/tmp/a', [
        { id: 'a-1', name: 'a', commands: ['echo a'], order: 0 } as never,
      ]);
      await service.startProjectProcesses('project-b', '/tmp/b', [
        { id: 'b-1', name: 'b', commands: ['echo b'], order: 0 } as never,
      ]);

      expect(service.getProcess('b-1')?.projectId).toBe('project-b');
    });

    it('returns null for an unknown id', () => {
      expect(service.getProcess('nope')).toBeNull();
      expect(service.getProcessOutputById('nope')).toBeNull();
    });
  });

  describe('start guards', () => {
    it('does not spawn a second pty for an already-running process', async () => {
      await startOne(service);
      await startOne(service);

      expect(spawned).toHaveLength(1);
    });
  });

  describe('killProcessTree', () => {
    it('signals the whole process group, not just the shell', async () => {
      // The bug this fixes: IPty.kill() reaches only the shell, so a dev
      // server's vite/esbuild children survive and keep holding their ports.
      const { processId, pty } = await startOne(service);
      const kill = vi.spyOn(process, 'kill').mockImplementation(() => true);

      await service.stopProcess('project-1', processId);

      expect(kill).toHaveBeenCalledWith(-pty.pid, 'SIGTERM');
    });

    it('escalates to SIGKILL for a group that ignored SIGTERM', async () => {
      vi.useFakeTimers();
      const { processId, pty } = await startOne(service);
      const kill = vi.spyOn(process, 'kill').mockImplementation(() => true);

      await service.stopProcess('project-1', processId);
      kill.mockClear();
      vi.advanceTimersByTime(3000);

      expect(kill).toHaveBeenCalledWith(-pty.pid, 0);
      expect(kill).toHaveBeenCalledWith(-pty.pid, 'SIGKILL');
      vi.useRealTimers();
    });

    it('does not escalate once the group is gone', async () => {
      vi.useFakeTimers();
      const { processId } = await startOne(service);
      const kill = vi.spyOn(process, 'kill').mockImplementation(() => true);

      await service.stopProcess('project-1', processId);
      kill.mockClear();
      // The liveness probe throwing is how we learn the group already exited.
      kill.mockImplementation(() => {
        throw Object.assign(new Error('no such process'), { code: 'ESRCH' });
      });
      vi.advanceTimersByTime(3000);

      expect(kill).toHaveBeenCalledTimes(1);
      expect(kill).toHaveBeenCalledWith(-1234, 0);
      vi.useRealTimers();
    });

    it.each([
      ['pid 0, which would signal our own process group', 0],
      ['pid 1, which would signal every process this user owns', 1],
      ['a negative pid', -5],
    ])('refuses to signal a group for %s', async (_label, pid) => {
      const { processId, pty } = await startOne(service);
      pty.pid = pid;
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const kill = vi.spyOn(process, 'kill').mockImplementation(() => true);

      await service.stopProcess('project-1', processId);

      expect(kill).not.toHaveBeenCalled();
    });

    it('falls back to the pty when the group signal fails', async () => {
      const { processId, pty } = await startOne(service);
      vi.spyOn(process, 'kill').mockImplementation(() => {
        throw new Error('EPERM');
      });

      await service.stopProcess('project-1', processId);

      expect(pty.kill).toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('signals the process group and forgets the process', async () => {
      const { processId, pty } = await startOne(service);
      // Must be mocked: without it the real kill(-1234) decides the outcome,
      // which depends on whether that group happens to exist on this machine.
      const kill = vi.spyOn(process, 'kill').mockImplementation(() => true);

      await service.stopProcess('project-1', processId);

      expect(kill).toHaveBeenCalledWith(-pty.pid, 'SIGTERM');
      expect(pty.kill).not.toHaveBeenCalled();
      expect(service.getProcess(processId)).toBeNull();
    });

    it('keeps tracking a process it could not signal', async () => {
      // Untracking here would hide a live process from the UI and from
      // cleanup on quit, leaving it unkillable from inside the app.
      const { processId, pty } = await startOne(service);
      pty.pid = 0;
      vi.spyOn(console, 'error').mockImplementation(() => {});

      await service.stopProcess('project-1', processId);

      expect(service.getProcess(processId)).not.toBeNull();
      expect(service.getProcess(processId)?.status).toBe('running');
    });

    it('reports failure from killProcess when it could not signal', async () => {
      const { processId, pty } = await startOne(service);
      pty.pid = 0;
      vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(await service.killProcess(processId)).toBe(false);
      expect(service.getProcess(processId)).not.toBeNull();
    });

    it('cleanup stops processes across every project', async () => {
      await service.startProjectProcesses('project-a', '/tmp/a', [
        { id: 'a-1', name: 'a', commands: ['echo a'], order: 0 } as never,
      ]);
      const ptyA = lastPty();
      await service.startProjectProcesses('project-b', '/tmp/b', [
        { id: 'b-1', name: 'b', commands: ['echo b'], order: 0 } as never,
      ]);
      const ptyB = lastPty();

      const kill = vi.spyOn(process, 'kill').mockImplementation(() => true);

      await service.cleanup();

      expect(kill).toHaveBeenCalledWith(-ptyA.pid, 'SIGTERM');
      expect(kill).toHaveBeenCalledWith(-ptyB.pid, 'SIGTERM');
      expect(service.getAllProcesses()).toEqual([]);
    });

    it('force-kills survivors before shutdown returns', async () => {
      // The normal escalation timer is unref'd and never fires once the app
      // exits, so cleanup has to escalate inline or a process ignoring
      // SIGTERM outlives the quit.
      vi.useFakeTimers();
      const { pty } = await startOne(service);
      const kill = vi.spyOn(process, 'kill').mockImplementation(() => true);

      const done = service.cleanup();
      await vi.advanceTimersByTimeAsync(1500);
      await done;

      expect(kill).toHaveBeenCalledWith(-pty.pid, 'SIGKILL');
      vi.useRealTimers();
    });
  });
});
