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
    pid: 4242,
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

  describe('stop', () => {
    it('kills the pty and forgets the process', async () => {
      const { processId, pty } = await startOne(service);

      await service.stopProcess('project-1', processId);

      expect(pty.kill).toHaveBeenCalled();
      expect(service.getProcess(processId)).toBeNull();
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

      await service.cleanup();

      expect(ptyA.kill).toHaveBeenCalled();
      expect(ptyB.kill).toHaveBeenCalled();
      expect(service.getAllProcesses()).toEqual([]);
    });
  });
});
