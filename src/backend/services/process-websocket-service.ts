import { IncomingMessage, Server as HttpServer } from 'http';
import { timingSafeEqual } from 'crypto';
import { WebSocket, WebSocketServer } from 'ws';
import { API_ROUTES, RUNTIME_CONFIG } from '../../shared/constants';
import {
  isValidTerminalSize,
  processManagerService,
  type ProcessSubscriber,
} from './process-manager-service';

/** Messages the client sends us. */
export type ProcessSocketRequest =
  | { action: 'input'; data: string }
  | { action: 'resize'; cols: number; rows: number }
  | { action: 'ping' };

/** Messages we send the client. */
export type ProcessSocketMessage =
  | { type: 'replay'; data: string; seq: number; reset: boolean }
  | {
      type: 'attached';
      processId: string;
      status: 'running' | 'stopped' | 'failed';
      exitCode?: number;
      cols: number;
      rows: number;
      seq: number;
    }
  | { type: 'output'; data: string; seq: number }
  | { type: 'exit'; exitCode: number }
  | { type: 'error'; message: string }
  | { type: 'pong' };

/** Largest frame we will accept, matching the input cap plus JSON overhead. */
const MAX_PAYLOAD_BYTES = 1024 * 1024;

/** Close codes, so the client can tell "gone" from "not allowed" apart. */
export const CLOSE_UNAUTHORIZED = 1008;

/**
 * Streams a running process's output to attached terminals and forwards their
 * keystrokes back to the PTY.
 *
 * Deliberately different from the older terminal WebSocket service in four
 * ways, each of which was a bug there:
 *  - subscriptions are released through a disposer on both close AND error,
 *    so a dropped socket cannot leak a listener onto a long-lived process;
 *  - viewers are a Set, so a second window attaching does not silently evict
 *    the first;
 *  - every send goes through one helper that checks readyState;
 *  - message handling lives in named methods rather than inside the
 *    connection closure, so it can be unit tested.
 */
export class ProcessWebSocketService {
  private wss: WebSocketServer | null = null;

  /** Per-socket teardown, so cleanup() releases subscriptions too. */
  private disposers: Map<WebSocket, () => void> = new Map();

  /** Last size each socket asked for, used to pick the shared PTY geometry. */
  private requestedSizes: Map<WebSocket, { cols: number; rows: number }> = new Map();

  /** Which process each socket is attached to. */
  private attachedTo: Map<WebSocket, string> = new Map();

  initialize(server: HttpServer): void {
    this.wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD_BYTES });

    server.on('upgrade', (request: IncomingMessage, socket, head) => {
      // Exact match: a prefix test would also capture unrelated paths that
      // merely start with this one.
      const { pathname, searchParams } = new URL(
        request.url ?? '',
        `http://${request.headers.host ?? 'localhost'}`
      );
      if (pathname !== API_ROUTES.PROCESS_WS) {
        return;
      }

      if (!isValidToken(searchParams.get('token'))) {
        // Refuse before the upgrade completes; an unauthenticated peer never
        // gets a WebSocket to talk on.
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      this.wss!.handleUpgrade(request, socket, head, ws => {
        this.wss!.emit('connection', ws, request);
      });
    });

    this.wss.on('connection', (ws: WebSocket, request: IncomingMessage) => {
      const { searchParams } = new URL(
        request.url ?? '',
        `http://${request.headers.host ?? 'localhost'}`
      );
      const processId = searchParams.get('id');

      if (!processId) {
        ws.close(CLOSE_UNAUTHORIZED, 'Process ID is required');
        return;
      }

      if (!this.handleAttach(ws, processId)) {
        return;
      }

      ws.on('message', (data: Buffer) => {
        this.handleMessage(ws, processId, data.toString());
      });

      // Both paths must release the subscription; only handling 'close' leaks
      // a listener whenever a socket errors out.
      ws.on('close', () => this.releaseSocket(ws, processId));
      ws.on('error', () => this.releaseSocket(ws, processId));
    });
  }

  /**
   * Subscribe a socket to a process and paint it the buffered scrollback.
   * Returns false when the process does not exist, having closed the socket.
   */
  handleAttach(ws: WebSocket, processId: string): boolean {
    const subscriber: ProcessSubscriber = {
      onData: (chunk, seq) => this.send(ws, { type: 'output', data: chunk, seq }),
      onExit: exitCode => this.send(ws, { type: 'exit', exitCode }),
    };

    const subscription = processManagerService.subscribe(processId, subscriber);
    if (!subscription) {
      ws.close(CLOSE_UNAUTHORIZED, 'Process not found');
      return false;
    }

    this.disposers.set(ws, subscription.unsubscribe);
    this.attachedTo.set(ws, processId);

    const snapshot = processManagerService.getProcessSnapshot(processId);

    // One frame rather than a chunk each: a thousand tiny messages on attach
    // is a visible stall in the renderer.
    this.send(ws, {
      type: 'replay',
      data: subscription.snapshot.join(''),
      seq: subscription.seq,
      reset: true,
    });

    this.send(ws, {
      type: 'attached',
      processId,
      status: snapshot?.status ?? 'running',
      exitCode: snapshot?.exitCode,
      cols: snapshot?.cols ?? 80,
      rows: snapshot?.rows ?? 24,
      seq: subscription.seq,
    });

    return true;
  }

  /**
   * Handle one inbound frame. Malformed input is reported to the client but
   * never thrown -- a bad frame must not take down the connection.
   */
  handleMessage(ws: WebSocket, processId: string, raw: string): void {
    let message: ProcessSocketRequest;
    try {
      message = JSON.parse(raw) as ProcessSocketRequest;
    } catch {
      this.send(ws, { type: 'error', message: 'Malformed message' });
      return;
    }

    switch (message?.action) {
      case 'input':
        if (typeof message.data === 'string') {
          processManagerService.writeToProcess(processId, message.data);
        }
        break;

      case 'resize':
        this.handleResize(ws, processId, message.cols, message.rows);
        break;

      case 'ping':
        this.send(ws, { type: 'pong' });
        break;

      default:
        // Unknown actions are ignored so an older client cannot break us.
        break;
    }
  }

  /**
   * Apply a resize request. With several terminals on one process we take the
   * smallest requested geometry, so no viewer ever sees output wrapped wider
   * than its own pane.
   */
  private handleResize(ws: WebSocket, processId: string, cols: number, rows: number): void {
    if (!isValidTerminalSize(cols, rows)) {
      this.send(ws, { type: 'error', message: 'Invalid terminal size' });
      return;
    }

    this.requestedSizes.set(ws, { cols, rows });

    let minCols = cols;
    let minRows = rows;
    for (const [socket, size] of this.requestedSizes) {
      if (this.attachedTo.get(socket) !== processId) {
        continue;
      }
      minCols = Math.min(minCols, size.cols);
      minRows = Math.min(minRows, size.rows);
    }

    processManagerService.resizeProcess(processId, minCols, minRows);
  }

  /** Release a socket's subscription and its bookkeeping, exactly once. */
  private releaseSocket(ws: WebSocket, processId: string): void {
    const dispose = this.disposers.get(ws);
    if (dispose) {
      this.disposers.delete(ws);
      dispose();
    }
    this.requestedSizes.delete(ws);
    this.attachedTo.delete(ws);

    // A departing viewer may have been the narrowest one; give the remaining
    // terminals back the width they asked for.
    this.reapplySize(processId);
  }

  /** Recompute the shared geometry from whoever is still attached. */
  private reapplySize(processId: string): void {
    let minCols = Infinity;
    let minRows = Infinity;
    for (const [socket, size] of this.requestedSizes) {
      if (this.attachedTo.get(socket) !== processId) {
        continue;
      }
      minCols = Math.min(minCols, size.cols);
      minRows = Math.min(minRows, size.rows);
    }

    if (Number.isFinite(minCols) && Number.isFinite(minRows)) {
      processManagerService.resizeProcess(processId, minCols, minRows);
    }
  }

  /** Single send path, so a closed socket is never written to. */
  private send(ws: WebSocket, message: ProcessSocketMessage): void {
    if (ws.readyState !== WebSocket.OPEN) {
      return;
    }
    ws.send(JSON.stringify(message));
  }

  /** Close every socket, releasing subscriptions first. */
  cleanup(): void {
    for (const [ws, dispose] of this.disposers) {
      dispose();
      ws.close();
    }
    this.disposers.clear();
    this.requestedSizes.clear();
    this.attachedTo.clear();
    this.wss?.close();
    this.wss = null;
  }
}

/**
 * Compare a client's token against this launch's, in constant time.
 *
 * Exported for testing; the length check is what makes timingSafeEqual safe to
 * call, since it throws on a length mismatch.
 */
export function isValidToken(candidate: string | null): boolean {
  const expected = RUNTIME_CONFIG.WS_TOKEN;
  if (!expected || !candidate) {
    return false;
  }

  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export const processWebSocketService = new ProcessWebSocketService();
