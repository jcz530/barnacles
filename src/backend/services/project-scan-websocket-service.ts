import { Server as HttpServer, IncomingMessage } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { projectScannerService } from './project-scanner-service';
import { projectService } from './project-service';

export interface ScanProgress {
  type: 'scan-started' | 'project-discovered' | 'project-updated' | 'scan-completed' | 'scan-error';
  projectPath?: string;
  projectData?: any;
  totalDiscovered?: number;
  error?: string;
}

export class ProjectScanWebSocketService {
  private wss: WebSocketServer | null = null;
  private connections: Set<WebSocket> = new Set();
  private activeScans: Map<string, boolean> = new Map();

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

      // Send initial connection success message
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'connected', message: 'Connected to project scanner' }));
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

    this.activeScans.set(scanId, true);

    try {
      // Default directories if none provided
      const os = await import('os');
      const path = await import('path');
      const defaultDirectories = [
        path.join(os.homedir(), 'Development'),
        path.join(os.homedir(), 'Projects'),
        path.join(os.homedir(), 'Code'),
        path.join(os.homedir(), 'workspace'),
        path.join(os.homedir(), 'Documents', 'Projects'),
      ];

      const dirsToScan = directories || defaultDirectories;

      // Notify scan started
      this.sendToClient(ws, {
        type: 'scan-started',
        totalDiscovered: 0,
      });

      let totalDiscovered = 0;

      // Scan directories and emit projects as they're discovered
      await this.scanDirectoriesIncremental(dirsToScan, maxDepth, async projectInfo => {
        try {
          // Save project to database
          const savedProject = await projectService.saveProject(projectInfo);

          totalDiscovered++;

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
      });

      // Notify scan completed
      this.sendToClient(ws, {
        type: 'scan-completed',
        totalDiscovered,
      });
    } catch (error) {
      console.error('Error during scan:', error);
      this.sendToClient(ws, {
        type: 'scan-error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      this.activeScans.delete(scanId);
    }
  }

  /**
   * Scan directories and emit projects incrementally as they're discovered
   */
  private async scanDirectoriesIncremental(
    basePaths: string[],
    maxDepth: number,
    onProjectDiscovered: (projectInfo: any) => Promise<void>
  ): Promise<void> {
    const fs = await import('fs/promises');
    const path = await import('path');
    const scanned = new Set<string>();

    async function scanRecursive(dirPath: string, depth: number): Promise<void> {
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
