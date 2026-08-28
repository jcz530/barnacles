import { createServer, type Server } from 'http';
import type { AddressInfo } from 'net';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WebSocket from 'ws';

const subscribe = vi.fn();
const getProcessSnapshot = vi.fn();

vi.mock('@backend/services/process-manager-service', async () => {
  const actual = await vi.importActual<typeof import('@backend/services/process-manager-service')>(
    '@backend/services/process-manager-service'
  );
  return {
    isValidTerminalSize: actual.isValidTerminalSize,
    processManagerService: {
      subscribe,
      getProcessSnapshot,
      writeToProcess: vi.fn(),
      resizeProcess: vi.fn(),
    },
  };
});

const { ProcessWebSocketService } = await import('@backend/services/process-websocket-service');
const { updateRuntimeConfig, RUNTIME_CONFIG } = await import('@shared/constants');

/**
 * The token check lives in the HTTP upgrade handler, which a fake socket can
 * never reach -- so unlike the sibling unit suite, this one drives a real
 * server and a real ws client. It is the only way to prove an unauthorized
 * peer is actually refused.
 */
describe('process WebSocket upgrade', () => {
  const TOKEN = 'f'.repeat(64);
  let server: Server;
  let service: InstanceType<typeof ProcessWebSocketService>;
  let port: number;
  const originalToken = RUNTIME_CONFIG.WS_TOKEN;
  const strays = new Set<{ destroy: () => void }>();

  beforeEach(async () => {
    vi.clearAllMocks();
    updateRuntimeConfig({ WS_TOKEN: TOKEN });
    subscribe.mockReturnValue({ snapshot: ['hello\r\n'], seq: 1, unsubscribe: vi.fn() });
    getProcessSnapshot.mockReturnValue({
      output: ['hello\r\n'],
      seq: 1,
      status: 'running',
      exitCode: undefined,
      cols: 80,
      rows: 24,
    });

    server = createServer();
    service = new ProcessWebSocketService();
    service.initialize(server);
    // An upgrade that no handler claims leaves its socket open forever, which
    // would stall server.close(). Track them so teardown can drop them. (The
    // same is true in the app; tracked as its own issue.)
    server.on('upgrade', (_req, socket) => strays.add(socket));
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterEach(async () => {
    service.cleanup();
    for (const socket of strays) {
      socket.destroy();
    }
    strays.clear();
    server.closeAllConnections?.();
    await new Promise<void>(resolve => server.close(() => resolve()));
    updateRuntimeConfig({ WS_TOKEN: originalToken });
  });

  function connect(query: string): WebSocket {
    return new WebSocket(`ws://127.0.0.1:${port}/api/processes/ws${query}`);
  }

  it('accepts a connection carrying the launch token and replays scrollback', async () => {
    const ws = connect(`?id=proc-1&token=${TOKEN}`);

    const message = await new Promise<Record<string, unknown>>((resolve, reject) => {
      ws.on('message', raw => resolve(JSON.parse(raw.toString())));
      ws.on('error', reject);
    });

    expect(message).toEqual({ type: 'replay', data: 'hello\r\n', seq: 1, reset: true });
    ws.close();
  });

  it('refuses a connection with a wrong token', async () => {
    const ws = connect(`?id=proc-1&token=${'0'.repeat(64)}`);

    const error = await new Promise<Error>(resolve => {
      ws.on('error', resolve);
      ws.on('open', () => resolve(new Error('connection unexpectedly opened')));
    });

    expect(error.message).toContain('401');
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('refuses a connection with no token at all', async () => {
    const ws = connect('?id=proc-1');

    const error = await new Promise<Error>(resolve => {
      ws.on('error', resolve);
      ws.on('open', () => resolve(new Error('connection unexpectedly opened')));
    });

    expect(error.message).toContain('401');
    expect(subscribe).not.toHaveBeenCalled();
  });

  it('ignores upgrades on paths that merely start with the socket path', async () => {
    // An exact pathname match; a prefix test would hand this to the service.
    //
    // Asserted by absence rather than by a close/error event: when no handler
    // claims an upgrade nobody destroys the socket, so the client just hangs.
    // That dangling-socket behavior is shared by all four WS services and is
    // tracked separately -- here we only care that we did not claim it.
    const ws = new WebSocket(
      `ws://127.0.0.1:${port}/api/processes/ws-elsewhere?id=proc-1&token=${TOKEN}`
    );
    const opened = await Promise.race([
      new Promise<boolean>(resolve => ws.on('open', () => resolve(true))),
      new Promise<boolean>(resolve => setTimeout(() => resolve(false), 300)),
    ]);

    expect(opened).toBe(false);
    expect(subscribe).not.toHaveBeenCalled();
    // terminate() throws while the handshake is still pending, and the socket
    // is deliberately never answered here, so tear it down quietly.
    ws.on('error', () => {});
    ws.close();
  });

  it('closes an authorized connection naming a process that does not exist', async () => {
    subscribe.mockReturnValue(null);
    const ws = connect(`?id=ghost&token=${TOKEN}`);

    const code = await new Promise<number>((resolve, reject) => {
      ws.on('close', resolve);
      ws.on('error', reject);
    });

    expect(code).toBe(1008);
  });
});
