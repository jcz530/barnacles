import { Server as HttpServer, IncomingMessage } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { projectScannerService } from './project-scanner-service';
import { projectService } from './project-service';
import { getDefaultScanDirectories } from '../utils/default-scan-directories';

export interface ScanProgress {
  type:
    | 'scan-started'
    | 'project-discovered'
    | 'project-updated'
    | 'scan-completed'
    | 'scan-error'
    | 'scan-status';
  projectPath?: string;
  projectData?: any;
  totalDiscovered?: number;
  error?: string;
  isScanning?: boolean;
}

export class ProjectScanWebSocketService {
  private wss: WebSocketServer | null = null;
  private connections: Set<WebSocket> = new Set();
  private activeScans: Map<string, { cancelled: boolean; totalDiscovered: number }> = new Map();

  /**
   * Initialize WebSocket server
   */
  initialize(server: HttpServer): void {
    this.wss = new WebSocketServer({ noServer: true });

    // Handle upgrade requests manually
    server.on('upgrade', (request, socket, head) => {
      if (request.url === '/api/projects/scan/ws') {
        this.wss!.handleUpgrade(request, socket, head, ws => {
          this.wss!.emit('connection', ws, request);
        });
      }
    });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      console.log('Project scan WebSocket connection established');
      this.connections.add(ws);

      // Handle incoming messages (scan commands)
      ws.on('message', async (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.action === 'start-scan') {
            const { directories, maxDepth } = message.payload || {};
            await this.handleScanRequest(ws, directories, maxDepth);
          } else if (message.action === 'stop-scan') {
            this.handleStopRequest(ws);
          }
        } catch (error) {
          console.error('Error handling scan WebSocket message:', error);
          this.sendToClient(ws, {
            type: 'scan-error',
            error: 'Failed to process scan request',
          });
        }
      });

      // Handle WebSocket close
      ws.on('close', () => {
        console.log('Project scan WebSocket closed');
        this.connections.delete(ws);
      });

      // Handle errors
      ws.on('error', error => {
        console.error('Project scan WebSocket error:', error);
        this.connections.delete(ws);
      });

      // Send initial connection success message and scan status
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'connected', message: 'Connected to project scanner' }));

        // If there's an active scan, notify the client
        if (this.activeScans.size > 0) {
          const [scanId, scanState] = Array.from(this.activeScans.entries())[0];
          ws.send(
            JSON.stringify({
              type: 'scan-status',
              isScanning: true,
              totalDiscovered: scanState.totalDiscovered,
            })
          );
        }
      }
    });

    console.log('✅ Project scan WebSocket server initialized');
  }

  /**
   * Handle scan request from client
   */
  private async handleScanRequest(
    ws: WebSocket,
    directories?: string[],
    maxDepth: number = 2
  ): Promise<void> {
    const scanId = Date.now().toString();

    // Check if a scan is already running
    if (this.activeScans.size > 0) {
      this.sendToClient(ws, {
        type: 'scan-error',
        error: 'A scan is already in progress',
      });
      return;
    }

    this.activeScans.set(scanId, { cancelled: false, totalDiscovered: 0 });

    try {
      // Default directories if none provided
      const dirsToScan = directories || (await getDefaultScanDirectories());

      // Notify scan started
      this.sendToClient(ws, {
        type: 'scan-started',
        totalDiscovered: 0,
      });

      let totalDiscovered = 0;

      // Scan directories and emit projects as they're discovered
      await this.scanDirectoriesIncremental(
        dirsToScan,
        maxDepth,
        async projectInfo => {
          // Check if scan was cancelled
          const scanState = this.activeScans.get(scanId);
          if (scanState?.cancelled) {
            throw new Error('Scan cancelled by user');
          }

          try {
            // Save project to database
            const savedProject = await projectService.saveProject(projectInfo);

            totalDiscovered++;

            // Update the scan state with current count
            const scanState = this.activeScans.get(scanId);
            if (scanState) {
              scanState.totalDiscovered = totalDiscovered;
            }

            // Emit to client
            this.sendToClient(ws, {
              type: 'project-discovered',
              projectPath: projectInfo.path,
              projectData: savedProject,
              totalDiscovered,
            });
          } catch (error) {
            console.error('Error saving discovered project:', error);
            this.sendToClient(ws, {
              type: 'scan-error',
              error: `Failed to save project: ${projectInfo.path}`,
            });
          }
        },
        scanId
      );

      // Check if cancelled before sending completion
      const scanState = this.activeScans.get(scanId);
      if (scanState?.cancelled) {
        this.sendToClient(ws, {
          type: 'scan-error',
          error: 'Scan cancelled',
        });
      } else {
        // Notify scan completed
        this.sendToClient(ws, {
          type: 'scan-completed',
          totalDiscovered,
        });
      }
    } catch (error) {
      console.error('Error during scan:', error);
      const scanState = this.activeScans.get(scanId);
      if (scanState?.cancelled) {
        this.sendToClient(ws, {
          type: 'scan-error',
          error: 'Scan cancelled',
        });
      } else {
        this.sendToClient(ws, {
          type: 'scan-error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    } finally {
      this.activeScans.delete(scanId);
    }
  }

  /**
   * Handle stop scan request from client
   */
  private handleStopRequest(ws: WebSocket): void {
    // Cancel all active scans
    for (const [scanId, scanState] of this.activeScans) {
      scanState.cancelled = true;
    }

    this.sendToClient(ws, {
      type: 'scan-error',
      error: 'Scan cancelled by user',
    });
  }

  /**
   * Scan directories and emit projects incrementally as they're discovered
   */
  private async scanDirectoriesIncremental(
    basePaths: string[],
    maxDepth: number,
    onProjectDiscovered: (projectInfo: any) => Promise<void>,
    scanId: string
  ): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    const scanned = new Set<string>();

    const self = this;
    async function scanRecursive(dirPath: string, depth: number): Promise<void> {
      // Check if scan was cancelled
      const scanState = self.activeScans.get(scanId);
      if (scanState?.cancelled) {
        return;
      }

      if (depth > maxDepth || scanned.has(dirPath)) {
        return;
      }

      scanned.add(dirPath);

      try {
        // Check if current directory is a project
        const projectInfo = await projectScannerService.scanProject(dirPath);
        if (projectInfo) {
          // Emit project immediately as discovered
          await onProjectDiscovered(projectInfo);
          // Don't scan subdirectories if we found a project
          return;
        }

        // Otherwise, scan subdirectories
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          // Check cancellation before each subdirectory
          const scanState = self.activeScans.get(scanId);
          if (scanState?.cancelled) {
            return;
          }

          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            await scanRecursive(path.join(dirPath, entry.name), depth + 1);
          }
        }
      } catch {
        // Skip directories we can't access
      }
    }

    for (const basePath of basePaths) {
      try {
        await fs.access(basePath);
        await scanRecursive(basePath, 0);
      } catch {
        // Skip paths that don't exist
      }
    }
  }

  /**
   * Send message to specific client
   */
  private sendToClient(ws: WebSocket, message: ScanProgress): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcast(message: ScanProgress): void {
    const messageStr = JSON.stringify(message);
    for (const ws of this.connections) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    }
  }

  /**
   * Cleanup all connections
   */
  cleanup(): void {
    for (const ws of this.connections) {
      ws.close(1000, 'Server shutting down');
    }
    this.connections.clear();
    this.wss?.close();
  }
}

export const projectScanWebSocketService = new ProjectScanWebSocketService();
