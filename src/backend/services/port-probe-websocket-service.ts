import { IncomingMessage, Server as HttpServer } from 'http';
import { WebSocket, WebSocketServer } from 'ws';

type ProbeMessage =
  | { type: 'probe-result'; port: number; isHttp: boolean; url: string; statusCode: number | null }
  | { type: 'probe-complete' };

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
          if (message.action === 'probe' && Array.isArray(message.ports)) {
            await this.handleProbeRequest(ws, message.ports as number[]);
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

  private async handleProbeRequest(ws: WebSocket, ports: number[]): Promise<void> {
    let active = 0;
    let index = 0;
    const results: Promise<void>[] = [];

    const next = (): Promise<void> => {
      if (index >= ports.length) return Promise.resolve();
      const port = ports[index++];
      active++;

      return this.probePort(port)
        .then(({ isHttp, statusCode }) => {
          if (ws.readyState === WebSocket.OPEN) {
            const msg: ProbeMessage = {
              type: 'probe-result',
              port,
              isHttp,
              statusCode,
              url: `http://127.0.0.1:${port}/`,
            };
            ws.send(JSON.stringify(msg));
          }
        })
        .finally(() => {
          active--;
          if (index < ports.length) {
            results.push(next());
          }
        });
    };

    // Seed up to MAX_CONCURRENT_PROBES workers
    const initial = Math.min(MAX_CONCURRENT_PROBES, ports.length);
    for (let i = 0; i < initial; i++) {
      results.push(next());
    }

    await Promise.all(results);

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'probe-complete' }));
    }
  }

  private async probePort(port: number): Promise<{ isHttp: boolean; statusCode: number | null }> {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`, {
        signal: AbortSignal.timeout(1000),
        redirect: 'manual',
      });
      return { isHttp: true, statusCode: res.status };
    } catch {
      return { isHttp: false, statusCode: null };
    }
  }
}

export const portProbeWebSocketService = new PortProbeWebSocketService();
