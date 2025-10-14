import { computed } from 'vue';
import { APP_CONFIG } from '../../shared/constants';

/**
 * Composable to detect and manage the API port
 * Attempts to find the actual API port from performance entries,
 * falling back to the preferred port if not found
 */
export function useApiPort() {
  /**
   * Find the API port from performance entries or use default
   */
  const getApiPort = (): number => {
    let apiPort = APP_CONFIG.API_PORT_PREFERRED;

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

    return apiPort;
  };

  /**
   * Get the API base URL (HTTP)
   */
  const apiBaseUrl = computed(() => {
    const port = getApiPort();
    return `http://localhost:${port}`;
  });

  /**
   * Get the WebSocket base URL (WS/WSS)
   */
  const wsBaseUrl = computed(() => {
    const port = getApiPort();
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//localhost:${port}`;
  });

  return {
    getApiPort,
    apiBaseUrl,
    wsBaseUrl,
  };
}
