import { Server as HttpServer, IncomingMessage } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { terminalService } from './terminal-service';

export class TerminalWebSocketService {
  private wss: WebSocketServer | null = null;
  private connections: Map<string, WebSocket> = new Map();

  /**
   * Initialize WebSocket server
   */
  initialize(server: HttpServer): void {
    this.wss = new WebSocketServer({
      server,
      path: '/api/terminals/ws',
    });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      // console.log('WebSocket connection established');

      // Extract terminal ID from query params
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const terminalId = url.searchParams.get('id');

      if (!terminalId) {
        ws.close(1008, 'Terminal ID is required');
        return;
      }

      const terminal = terminalService.getTerminal(terminalId);
      if (!terminal) {
        ws.close(1008, 'Terminal not found');
        return;
      }

      // Store the connection
      this.connections.set(terminalId, ws);

      // Get the terminal process for streaming
      const process = terminalService.getTerminalProcess(terminalId);
      if (!process) {
        ws.close(1008, 'Terminal process not found');
        return;
      }

      // Stream stdout to WebSocket
      process.stdout?.on('data', (data: Buffer) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data.toString());
        }
      });

      // Stream stderr to WebSocket
      process.stderr?.on('data', (data: Buffer) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data.toString());
        }
      });

      // Handle process exit
      process.on('exit', code => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(`\r\n[Process exited with code ${code}]\r\n`);
          ws.close(1000, 'Process exited');
        }
        this.connections.delete(terminalId);
      });

      // Handle incoming messages (user input)
      ws.on('message', (data: Buffer) => {
        const input = data.toString();
        terminalService.writeToTerminal(terminalId, input);
      });

      // Handle WebSocket close
      ws.on('close', () => {
        console.log(`WebSocket closed for terminal ${terminalId}`);
        this.connections.delete(terminalId);
      });

      // Handle errors
      ws.on('error', error => {
        console.error(`WebSocket error for terminal ${terminalId}:`, error);
        this.connections.delete(terminalId);
      });

      // Send initial connection success message
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(`Connected to terminal: ${terminal.title}\r\n`);
      }
    });

    console.log('✅ Terminal WebSocket server initialized');
  }

  /**
   * Broadcast a message to a specific terminal
   */
  broadcast(terminalId: string, message: string): void {
    const ws = this.connections.get(terminalId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  }

  /**
   * Close connection for a specific terminal
   */
  closeConnection(terminalId: string): void {
    const ws = this.connections.get(terminalId);
    if (ws) {
      ws.close(1000, 'Connection closed by server');
      this.connections.delete(terminalId);
    }
  }

  /**
   * Cleanup all connections
   */
  cleanup(): void {
    for (const [terminalId, ws] of this.connections.entries()) {
      ws.close(1000, 'Server shutting down');
    }
    this.connections.clear();
    this.wss?.close();
  }
}

export const terminalWebSocketService = new TerminalWebSocketService();
