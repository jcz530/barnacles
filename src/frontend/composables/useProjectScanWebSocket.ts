import { onUnmounted, ref } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { useThrottleFn } from '@vueuse/core';
import { toast } from 'vue-sonner';
import type { ProjectWithDetails } from '../../shared/types/api';
import { toastLoadingWithVariant } from '@/components/ui/sonner';
import { useApiPort } from './useApiPort';

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
  const { wsBaseUrl, isLoaded, loadApiPort } = useApiPort();
  let scanToastId: string | number | undefined;

  /**
   * Throttle query invalidation to avoid excessive refetches
   * This ensures we only invalidate once per second at most
   */
  const throttledInvalidateProjects = useThrottleFn(
    () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
    1000,
    true, // trailing - ensures a final call happens after the last invocation
    false // leading - don't call immediately on first invocation
  );

  /**
   * Connect to the WebSocket server
   */
  const connect = async () => {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    // Ensure we have the correct port before connecting
    if (!isLoaded.value) {
      await loadApiPort();
    }

    const wsUrl = `${wsBaseUrl.value}/api/projects/scan/ws`;

    ws.value = new WebSocket(wsUrl);

    ws.value.onopen = () => {
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
      isConnected.value = false;
    };
  };

  /**
   * Handle incoming WebSocket messages
   */
  const handleMessage = (message: ScanProgressMessage) => {
    switch (message.type) {
      case 'connected':
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

          // Use throttled invalidation to avoid excessive refetches
          throttledInvalidateProjects();
        }
        break;

      case 'project-updated':
        if (message.projectData) {
          // Update existing project in discovered list
          const index = discoveredProjects.value.findIndex(p => p.path === message.projectPath);
          if (index !== -1) {
            discoveredProjects.value[index] = message.projectData;
          }

          // Use throttled invalidation to avoid excessive refetches
          throttledInvalidateProjects();
        }
        break;

      case 'scan-completed':
        isScanning.value = false;
        totalDiscovered.value = message.totalDiscovered || totalDiscovered.value;

        // Do a final invalidation to ensure UI is up-to-date
        queryClient.invalidateQueries({ queryKey: ['projects'] });

        // Dismiss the loading toast and show a fresh success toast
        if (scanToastId !== undefined) {
          toast.dismiss(scanToastId);
          scanToastId = undefined;
        }

        toast.success('Scan completed', {
          description: `Found ${totalDiscovered.value} projects`,
          duration: 15000,
        });
        break;

      case 'scan-error':
        isScanning.value = false;
        error.value = message.error || 'Unknown error occurred';
        console.error('Scan error:', message.error);

        // Do a final invalidation to ensure UI is up-to-date
        queryClient.invalidateQueries({ queryKey: ['projects'] });

        // Dismiss the loading toast and show error (or info if cancelled)
        if (scanToastId !== undefined) {
          toast.dismiss(scanToastId);
          scanToastId = undefined;
        }

        if (message.error?.toLowerCase().includes('cancel')) {
          toast.info('Scan cancelled', {
            description: `Found ${totalDiscovered.value} projects before cancellation`,
            duration: 10000,
          });
        } else {
          toast.error('Scan failed', {
            description: message.error || 'An error occurred during scanning',
            duration: 5000,
          });
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
