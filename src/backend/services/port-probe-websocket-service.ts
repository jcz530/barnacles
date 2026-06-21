import { IncomingMessage, Server as HttpServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { lookup } from 'dns/promises';
import {
  computeContentSignature,
  getFresh,
  isKnownNonHttp,
  markNonHttp,
  clearNonHttp,
} from './port-screenshot-cache-service';

interface CachedScreenshotInfo {
  fileName: string;
  capturedAt: string;
}

type ProbeMessage =
  | {
      type: 'probe-result';
      port: number;
      isHttp: boolean;
      url: string;
      captureUrl: string;
      statusCode: number | null;
      signature: string | null;
      cachedScreenshot: CachedScreenshotInfo | null;
    }
  | { type: 'probe-complete' };

interface ProbeTarget {
  port: number;
  processName: string;
}

const MAX_CONCURRENT_PROBES = 10;

export class PortProbeWebSocketService {
  private wss: WebSocketServer | null = null;

  initialize(server: HttpServer): void {
    this.wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (request: IncomingMessage, socket, head) => {
      if (request.url === '/api/ports/probe/ws') {
        this.wss!.handleUpgrade(request, socket, head, ws => {
          this.wss!.emit('connection', ws, request);
        });
      }
    });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('Port probe WebSocket connection established');

      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.action === 'probe' && Array.isArray(message.targets)) {
            await this.handleProbeRequest(ws, message.targets as ProbeTarget[]);
          }
        } catch (error) {
          console.error('Error handling port probe WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        console.log('Port probe WebSocket connection closed');
      });
    });
  }

  private async handleProbeRequest(ws: WebSocket, targets: ProbeTarget[]): Promise<void> {
    let index = 0;
    const results: Promise<void>[] = [];

    const next = (): Promise<void> => {
      if (index >= targets.length) return Promise.resolve();
      const target = targets[index++];

      return this.probeTarget(target)
        .then(msg => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(msg));
          }
        })
        .finally(() => {
          if (index < targets.length) {
            results.push(next());
          }
        });
    };

    const initial = Math.min(MAX_CONCURRENT_PROBES, targets.length);
    for (let i = 0; i < initial; i++) {
      results.push(next());
    }

    await Promise.all(results);

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'probe-complete' }));
    }
  }

  private async probeTarget(target: ProbeTarget): Promise<ProbeMessage> {
    const { port, processName } = target;
    const url = `http://localhost:${port}/`;

    if (isKnownNonHttp(port)) {
      return {
        type: 'probe-result',
        port,
        isHttp: false,
        url,
        captureUrl: url,
        statusCode: null,
        signature: null,
        cachedScreenshot: null,
      };
    }

    // `url` (shown to the user / used for "open in browser") always says
    // `localhost` - real browsers resolve that fine. But Electron's
    // `loadURL`, used for screenshot capture, fails outright on a bare
    // `localhost` against a server that only listens on one address family
    // (e.g. Astro/Vite binding only to ::1). So for capture we resolve
    // `localhost` ourselves and use whichever concrete loopback address
    // actually answers.
    const addresses = await this.resolveLoopbackAddresses();

    for (const address of addresses) {
      const host = address.includes(':') ? `[${address}]` : address;
      const captureUrl = `http://${host}:${port}/`;
      try {
        const res = await fetch(captureUrl, {
          signal: AbortSignal.timeout(1000),
          redirect: 'manual',
        });

        clearNonHttp(port);

        const signature = computeContentSignature({
          etag: res.headers.get('etag'),
          lastModified: res.headers.get('last-modified'),
          contentLength: res.headers.get('content-length'),
        });

        const cached = await getFresh(port, processName, signature);

        return {
          type: 'probe-result',
          port,
          isHttp: true,
          url,
          captureUrl,
          statusCode: res.status,
          signature,
          cachedScreenshot: cached
            ? { fileName: cached.fileName, capturedAt: cached.capturedAt.toISOString() }
            : null,
        };
      } catch {
        // try next address
      }
    }

    markNonHttp(port);
    return {
      type: 'probe-result',
      port,
      isHttp: false,
      url,
      captureUrl: url,
      statusCode: null,
      signature: null,
      cachedScreenshot: null,
    };
  }

  private async resolveLoopbackAddresses(): Promise<string[]> {
    try {
      const results = await lookup('localhost', { all: true });
      return results.map(r => r.address);
    } catch {
      return ['127.0.0.1'];
    }
  }
}

export const portProbeWebSocketService = new PortProbeWebSocketService();
