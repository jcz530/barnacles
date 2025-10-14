import { ref, onUnmounted } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { toast } from 'vue-sonner';
import { APP_CONFIG } from '../../shared/constants';
import type { ProjectWithDetails } from '../../shared/types/api';
import { toastLoadingWithVariant } from '@/components/ui/sonner';

interface ScanProgressMessage {
  type:
    | 'connected'
    | 'scan-started'
    | 'project-discovered'
    | 'project-updated'
    | 'scan-completed'
    | 'scan-error'
    | 'scan-status';
  projectPath?: string;
  projectData?: ProjectWithDetails;
  totalDiscovered?: number;
  error?: string;
  message?: string;
  isScanning?: boolean;
}

export function useProjectScanWebSocket() {
  const queryClient = useQueryClient();
  const ws = ref<WebSocket | null>(null);
  const isConnected = ref(false);
  const isScanning = ref(false);
  const totalDiscovered = ref(0);
  const error = ref<string | null>(null);
  const discoveredProjects = ref<ProjectWithDetails[]>([]);
  let scanToastId: string | number | undefined;

  /**
   * Connect to the WebSocket server
   */
  const connect = () => {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    // Get the API base URL from the API_BASE_URL constant
    // which is set at runtime by the backend
    // We need to extract it from a meta tag or use the RUNTIME_CONFIG
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    // Try to get the actual API host and port from existing fetch calls
    // For Electron apps, the API runs on a different port than the renderer
    // We can check the document for any script or meta tags that might have it
    // Or we can try both 51000 and 51001

    // First, try to find an existing API call's URL
    let apiPort = APP_CONFIG.API_PORT_PREFERRED;

    // Check if there's a performance entry from a recent API call
    try {
      const perfEntries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const apiCall = perfEntries.find(
        entry => entry.name.includes('/api/') && entry.name.includes('localhost')
      );
      if (apiCall) {
        const url = new URL(apiCall.name);
        apiPort = parseInt(url.port) || apiPort;
      }
    } catch {
      // Fallback to default port
    }

    const wsUrl = `${protocol}//localhost:${apiPort}/api/projects/scan/ws`;
    console.log('Connecting to WebSocket:', wsUrl);

    ws.value = new WebSocket(wsUrl);

    ws.value.onopen = () => {
      console.log('Connected to project scan WebSocket');
      isConnected.value = true;
      error.value = null;
    };

    ws.value.onmessage = event => {
      try {
        const message: ScanProgressMessage = JSON.parse(event.data);
        handleMessage(message);
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    ws.value.onerror = event => {
      console.error('WebSocket error:', event);
      error.value = 'WebSocket connection error';
      isConnected.value = false;

      // Show error toast
      toast.error('Connection failed', {
        description: 'Could not connect to project scanner',
        duration: 5000,
      });
    };

    ws.value.onclose = () => {
      console.log('Disconnected from project scan WebSocket');
      isConnected.value = false;
    };
  };

  /**
   * Handle incoming WebSocket messages
   */
  const handleMessage = (message: ScanProgressMessage) => {
    switch (message.type) {
      case 'connected':
        console.log('WebSocket connected:', message.message);
        break;

      case 'scan-status':
        // Server is telling us about an ongoing scan (happens on reconnect/refresh)
        if (message.isScanning) {
          isScanning.value = true;
          totalDiscovered.value = message.totalDiscovered || 0;
          // Show the toast with current progress
          scanToastId = toastLoadingWithVariant('Discovering projects...', {
            description: `${totalDiscovered.value} projects found so far`,
            duration: Infinity,
            variant: 'info',
            loader: 'scan',
            action: {
              label: 'Cancel',
              onClick: () => {
                stopScan();
              },
            },
          });
        }
        break;

      case 'scan-started':
        isScanning.value = true;
        totalDiscovered.value = 0;
        discoveredProjects.value = [];
        error.value = null;
        // Show persistent toast during scanning
        scanToastId = toastLoadingWithVariant('Discovering projects...', {
          description: '0 projects found so far',
          duration: Infinity, // Keep it open until we dismiss it
          variant: 'info',
          loader: 'scan',
          action: {
            label: 'Cancel',
            onClick: () => {
              stopScan();
            },
          },
        });
        break;

      case 'project-discovered':
        if (message.projectData) {
          totalDiscovered.value = message.totalDiscovered || totalDiscovered.value + 1;
          discoveredProjects.value.push(message.projectData);

          // Update the scanning toast with current count
          if (scanToastId !== undefined) {
            toastLoadingWithVariant('Discovering projects...', {
              id: scanToastId,
              description: `${totalDiscovered.value} projects found so far`,
              duration: Infinity,
              variant: 'info',
              loader: 'scan',
              action: {
                label: 'Cancel',
                onClick: () => {
                  stopScan();
                },
              },
            });
          }

          // Invalidate queries to trigger refetch and update UI
          queryClient.invalidateQueries({ queryKey: ['projects'] });
        }
        break;

      case 'project-updated':
        if (message.projectData) {
          // Update existing project in discovered list
          const index = discoveredProjects.value.findIndex(p => p.path === message.projectPath);
          if (index !== -1) {
            discoveredProjects.value[index] = message.projectData;
          }

          // Invalidate queries to trigger refetch
          queryClient.invalidateQueries({ queryKey: ['projects'] });
        }
        break;

      case 'scan-completed':
        isScanning.value = false;
        totalDiscovered.value = message.totalDiscovered || totalDiscovered.value;
        console.log(`Scan completed: ${totalDiscovered.value} projects discovered`);

        // Dismiss the loading toast and show success
        if (scanToastId !== undefined) {
          toast.success('Scan completed', {
            id: scanToastId,
            description: `Found ${totalDiscovered.value} projects`,
            duration: 3000,
          });
          scanToastId = undefined;
        }
        break;

      case 'scan-error':
        isScanning.value = false;
        error.value = message.error || 'Unknown error occurred';
        console.error('Scan error:', message.error);

        // Dismiss the loading toast and show error (or success if cancelled)
        if (scanToastId !== undefined) {
          const isCancelled = message.error?.toLowerCase().includes('cancel');
          if (isCancelled) {
            toast.info('Scan cancelled', {
              id: scanToastId,
              description: `Found ${totalDiscovered.value} projects before cancellation`,
              duration: 3000,
            });
          } else {
            toast.error('Scan failed', {
              id: scanToastId,
              description: message.error || 'An error occurred during scanning',
              duration: 5000,
            });
          }
          scanToastId = undefined;
        }
        break;
    }
  };

  /**
   * Start scanning for projects
   */
  const startScan = (options?: { directories?: string[]; maxDepth?: number }) => {
    if (!isConnected.value) {
      connect();

      // Wait for connection before sending scan command
      const checkConnection = setInterval(() => {
        if (isConnected.value && ws.value) {
          clearInterval(checkConnection);
          sendScanCommand(options);
        }
      }, 100);

      // Timeout after 5 seconds
      setTimeout(() => {
        clearInterval(checkConnection);
        if (!isConnected.value) {
          error.value = 'Failed to connect to WebSocket server';
        }
      }, 5000);
    } else {
      sendScanCommand(options);
    }
  };

  /**
   * Send scan command to the server
   */
  const sendScanCommand = (options?: { directories?: string[]; maxDepth?: number }) => {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      ws.value.send(
        JSON.stringify({
          action: 'start-scan',
          payload: options,
        })
      );
    } else {
      error.value = 'WebSocket is not connected';
    }
  };

  /**
   * Stop the current scan
   */
  const stopScan = () => {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      ws.value.send(
        JSON.stringify({
          action: 'stop-scan',
        })
      );
    }
  };

  /**
   * Disconnect from the WebSocket server
   */
  const disconnect = () => {
    if (ws.value) {
      ws.value.close();
      ws.value = null;
    }
    isConnected.value = false;
  };

  /**
   * Reset state
   */
  const reset = () => {
    totalDiscovered.value = 0;
    error.value = null;
    discoveredProjects.value = [];
    isScanning.value = false;
  };

  // Cleanup on component unmount
  onUnmounted(() => {
    disconnect();
  });

  return {
    // State
    isConnected,
    isScanning,
    totalDiscovered,
    error,
    discoveredProjects,

    // Methods
    connect,
    disconnect,
    startScan,
    stopScan,
    reset,
  };
}
