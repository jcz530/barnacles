import { ref, computed, onMounted } from 'vue';
import { APP_CONFIG } from '../../shared/constants';

/**
 * Composable to detect and manage the API port
 * Gets the actual API port from Electron IPC,
 * falling back to the preferred port if not available
 */
export function useApiPort() {
  const port = ref<number>(APP_CONFIG.API_PORT_PREFERRED);
  const isLoaded = ref(false);

  /**
   * Load the actual API port from Electron IPC
   */
  const loadApiPort = async () => {
    try {
      const config = await window.electronAPI.getApiConfig();
      port.value = config.port;
      isLoaded.value = true;
    } catch {
      // Fallback to default port if IPC fails
      port.value = APP_CONFIG.API_PORT_PREFERRED;
      isLoaded.value = true;
    }
  };

  // Load port on mount
  onMounted(() => {
    loadApiPort();
  });

  /**
   * Get the API port (for backwards compatibility)
   */
  const getApiPort = (): number => {
    return port.value;
  };

  /**
   * Get the API base URL (HTTP)
   */
  const apiBaseUrl = computed(() => {
    return `http://localhost:${port.value}`;
  });

  /**
   * Get the WebSocket base URL (WS/WSS)
   */
  const wsBaseUrl = computed(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//localhost:${port.value}`;
  });

  return {
    getApiPort,
    apiBaseUrl,
    wsBaseUrl,
    port,
    isLoaded,
    loadApiPort,
  };
}
