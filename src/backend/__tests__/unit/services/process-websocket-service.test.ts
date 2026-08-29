import { beforeEach, describe, expect, it, vi } from 'vitest';

const subscribe = vi.fn();
const writeToProcess = vi.fn();
const resizeProcess = vi.fn();
const getProcessSnapshot = vi.fn();

vi.mock('@backend/services/process-manager-service', async () => {
  // isValidTerminalSize is pure, so use the real one rather than a stub that
  // could drift from the bounds the service actually enforces.
  const actual = await vi.importActual<typeof import('@backend/services/process-manager-service')>(
    '@backend/services/process-manager-service'
  );
  return {
    isValidTerminalSize: actual.isValidTerminalSize,
    processManagerService: { subscribe, writeToProcess, resizeProcess, getProcessSnapshot },
  };
});

const { ProcessWebSocketService, isValidToken } =
  await import('@backend/services/process-websocket-service');
const { RUNTIME_CONFIG, updateRuntimeConfig } = await import('@shared/constants');

type Service = InstanceType<typeof ProcessWebSocketService>;

/** The private surface the connection closure would normally reach. */
type ServiceInternals = {
  handleMessage: (ws: unknown, processId: string, raw: string) => void;
  handleAttach: (ws: unknown, processId: string) => boolean;
  releaseSocket: (ws: unknown, processId: string) => void;
};

function internals(service: Service): ServiceInternals {
  return service as unknown as ServiceInternals;
}

/** A socket stand-in; readyState 1 is OPEN. */
function fakeWs(readyState = 1) {
  return { readyState, send: vi.fn(), close: vi.fn() };
}

/** Parse the JSON messages a fake socket was sent. */
function sentMessages(ws: ReturnType<typeof fakeWs>) {
  return ws.send.mock.calls.map(call => JSON.parse(call[0] as string));
}

describe('ProcessWebSocketService', () => {
  let service: Service;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ProcessWebSocketService();
    subscribe.mockReturnValue({
      snapshot: [],
      seq: 0,
      unsubscribe: vi.fn(),
    });
    getProcessSnapshot.mockReturnValue({
      output: [],
      seq: 0,
      status: 'running',
      exitCode: undefined,
      cols: 80,
      rows: 24,
    });
  });

  describe('attach', () => {
    it('replays scrollback in a single frame, then reports attached', () => {
      const ws = fakeWs();
      subscribe.mockReturnValue({
        snapshot: ['one\r\n', 'two\r\n'],
        seq: 2,
        unsubscribe: vi.fn(),
      });

      expect(internals(service).handleAttach(ws, 'proc-1')).toBe(true);

      expect(sentMessages(ws)).toEqual([
        { type: 'replay', data: 'one\r\ntwo\r\n', seq: 2, reset: true },
        {
          type: 'attached',
          processId: 'proc-1',
          status: 'running',
          cols: 80,
          rows: 24,
          seq: 2,
        },
      ]);
    });

    it('closes the socket when the process does not exist', () => {
      const ws = fakeWs();
      subscribe.mockReturnValue(null);

      expect(internals(service).handleAttach(ws, 'ghost')).toBe(false);
      expect(ws.close).toHaveBeenCalledWith(1008, 'Process not found');
      expect(ws.send).not.toHaveBeenCalled();
    });

    it('forwards live output and exit to the socket', () => {
      const ws = fakeWs();
      let captured: { onData: (c: string, s: number) => void; onExit: (c: number) => void };
      subscribe.mockImplementation((_id, subscriber) => {
        captured = subscriber;
        return { snapshot: [], seq: 0, unsubscribe: vi.fn() };
      });

      internals(service).handleAttach(ws, 'proc-1');
      ws.send.mockClear();

      captured!.onData('live\r\n', 1);
      captured!.onExit(0);

      expect(sentMessages(ws)).toEqual([
        { type: 'output', data: 'live\r\n', seq: 1 },
        { type: 'exit', exitCode: 0 },
      ]);
    });
  });

  describe('input', () => {
    it('forwards input to the process', () => {
      const ws = fakeWs();

      internals(service).handleMessage(
        ws,
        'proc-1',
        JSON.stringify({ action: 'input', data: 'ls\r' })
      );

      expect(writeToProcess).toHaveBeenCalledWith('proc-1', 'ls\r');
    });

    it('ignores an input frame whose data is not a string', () => {
      const ws = fakeWs();

      internals(service).handleMessage(ws, 'proc-1', JSON.stringify({ action: 'input', data: 42 }));

      expect(writeToProcess).not.toHaveBeenCalled();
    });
  });

  describe('resize', () => {
    it('resizes the process', () => {
      const ws = fakeWs();

      internals(service).handleMessage(
        ws,
        'proc-1',
        JSON.stringify({ action: 'resize', cols: 100, rows: 40 })
      );

      expect(resizeProcess).toHaveBeenCalledWith('proc-1', 100, 40);
    });

    it.each([
      ['zero cols', 0, 24],
      ['negative rows', 80, -5],
      ['fractional', 80.5, 24],
      ['absurd width', 99_999, 24],
    ])('rejects %s without touching the process', (_label, cols, rows) => {
      const ws = fakeWs();

      internals(service).handleMessage(
        ws,
        'proc-1',
        JSON.stringify({ action: 'resize', cols, rows })
      );

      expect(resizeProcess).not.toHaveBeenCalled();
      expect(sentMessages(ws)).toContainEqual({
        type: 'error',
        message: 'Invalid terminal size',
      });
    });

    it('uses the smallest geometry when two terminals share a process', () => {
      // The wider viewer must not make output wrap past the narrower one's pane.
      const wide = fakeWs();
      const narrow = fakeWs();
      internals(service).handleAttach(wide, 'proc-1');
      internals(service).handleAttach(narrow, 'proc-1');

      internals(service).handleMessage(
        wide,
        'proc-1',
        JSON.stringify({ action: 'resize', cols: 200, rows: 50 })
      );
      internals(service).handleMessage(
        narrow,
        'proc-1',
        JSON.stringify({ action: 'resize', cols: 80, rows: 24 })
      );

      expect(resizeProcess).toHaveBeenLastCalledWith('proc-1', 80, 24);
    });

    it('gives the width back when the narrower terminal detaches', () => {
      const wide = fakeWs();
      const narrow = fakeWs();
      internals(service).handleAttach(wide, 'proc-1');
      internals(service).handleAttach(narrow, 'proc-1');
      internals(service).handleMessage(
        wide,
        'proc-1',
        JSON.stringify({ action: 'resize', cols: 200, rows: 50 })
      );
      internals(service).handleMessage(
        narrow,
        'proc-1',
        JSON.stringify({ action: 'resize', cols: 80, rows: 24 })
      );

      internals(service).releaseSocket(narrow, 'proc-1');

      expect(resizeProcess).toHaveBeenLastCalledWith('proc-1', 200, 50);
    });

    it('does not let a viewer of another process shrink this one', () => {
      const mine = fakeWs();
      const other = fakeWs();
      internals(service).handleAttach(mine, 'proc-1');
      internals(service).handleAttach(other, 'proc-2');

      internals(service).handleMessage(
        other,
        'proc-2',
        JSON.stringify({ action: 'resize', cols: 40, rows: 10 })
      );
      internals(service).handleMessage(
        mine,
        'proc-1',
        JSON.stringify({ action: 'resize', cols: 120, rows: 40 })
      );

      expect(resizeProcess).toHaveBeenLastCalledWith('proc-1', 120, 40);
    });
  });

  describe('malformed and unknown frames', () => {
    it('reports malformed JSON without throwing', () => {
      const ws = fakeWs();

      expect(() => internals(service).handleMessage(ws, 'proc-1', 'not json')).not.toThrow();
      expect(sentMessages(ws)).toEqual([{ type: 'error', message: 'Malformed message' }]);
    });

    it('ignores an unknown action, so an older client cannot break us', () => {
      const ws = fakeWs();

      internals(service).handleMessage(ws, 'proc-1', JSON.stringify({ action: 'teleport' }));

      expect(writeToProcess).not.toHaveBeenCalled();
      expect(resizeProcess).not.toHaveBeenCalled();
      expect(ws.send).not.toHaveBeenCalled();
    });

    it('answers a ping', () => {
      const ws = fakeWs();

      internals(service).handleMessage(ws, 'proc-1', JSON.stringify({ action: 'ping' }));

      expect(sentMessages(ws)).toEqual([{ type: 'pong' }]);
    });
  });

  describe('teardown', () => {
    it('unsubscribes exactly once, even if release runs twice', () => {
      // 'close' and 'error' can both fire for one socket; the second must be
      // a no-op rather than a double free.
      const ws = fakeWs();
      const unsubscribe = vi.fn();
      subscribe.mockReturnValue({ snapshot: [], seq: 0, unsubscribe });
      internals(service).handleAttach(ws, 'proc-1');

      internals(service).releaseSocket(ws, 'proc-1');
      internals(service).releaseSocket(ws, 'proc-1');

      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('cleanup unsubscribes and closes every socket', () => {
      const first = fakeWs();
      const second = fakeWs();
      const unsubscribe = vi.fn();
      subscribe.mockReturnValue({ snapshot: [], seq: 0, unsubscribe });
      internals(service).handleAttach(first, 'proc-1');
      internals(service).handleAttach(second, 'proc-2');

      service.cleanup();

      expect(unsubscribe).toHaveBeenCalledTimes(2);
      expect(first.close).toHaveBeenCalled();
      expect(second.close).toHaveBeenCalled();
    });
  });

  describe('send guard', () => {
    it('never writes to a socket that is not open', () => {
      const closing = fakeWs(2); // CLOSING

      internals(service).handleMessage(closing, 'proc-1', 'not json');

      expect(closing.send).not.toHaveBeenCalled();
    });
  });

  describe('isValidToken', () => {
    const original = RUNTIME_CONFIG.WS_TOKEN;

    it('accepts the current launch token', () => {
      updateRuntimeConfig({ WS_TOKEN: 'a'.repeat(64) });
      expect(isValidToken('a'.repeat(64))).toBe(true);
      updateRuntimeConfig({ WS_TOKEN: original });
    });

    it('rejects a wrong token of the same length', () => {
      updateRuntimeConfig({ WS_TOKEN: 'a'.repeat(64) });
      expect(isValidToken('b'.repeat(64))).toBe(false);
      updateRuntimeConfig({ WS_TOKEN: original });
    });

    it('rejects a token of a different length without throwing', () => {
      // timingSafeEqual throws on mismatched lengths, so the guard matters.
      updateRuntimeConfig({ WS_TOKEN: 'a'.repeat(64) });
      expect(() => isValidToken('short')).not.toThrow();
      expect(isValidToken('short')).toBe(false);
      updateRuntimeConfig({ WS_TOKEN: original });
    });

    it('rejects a missing token', () => {
      updateRuntimeConfig({ WS_TOKEN: 'a'.repeat(64) });
      expect(isValidToken(null)).toBe(false);
      updateRuntimeConfig({ WS_TOKEN: original });
    });

    it('refuses everything when no token has been minted', () => {
      // Fail closed: an unminted token must not mean "allow all".
      updateRuntimeConfig({ WS_TOKEN: '' });
      expect(isValidToken('')).toBe(false);
      expect(isValidToken('anything')).toBe(false);
      updateRuntimeConfig({ WS_TOKEN: original });
    });
  });
});
