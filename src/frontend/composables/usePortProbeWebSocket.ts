import { onUnmounted, ref, watch } from 'vue';
import type { Ref } from 'vue';
import { useApiPort } from './useApiPort';

interface ProbeResult {
  isHttp: boolean;
  url: string;
  statusCode: number | null;
}

export function usePortProbeWebSocket(ports: Ref<number[]>) {
  const ws = ref<WebSocket | null>(null);
  const isConnected = ref(false);
  const isProbing = ref(false);
  const error = ref<string | null>(null);
  const probeResults = ref<Map<number, ProbeResult>>(new Map());

  const { wsBaseUrl, isLoaded, loadApiPort } = useApiPort();

  const disconnect = () => {
    if (ws.value) {
      ws.value.close();
      ws.value = null;
    }
    isConnected.value = false;
    isProbing.value = false;
  };

  const connect = async (portList: number[]) => {
    if (portList.length === 0) return;

    disconnect();

    if (!isLoaded.value) {
      await loadApiPort();
    }

    const wsUrl = `${wsBaseUrl.value}/api/ports/probe/ws`;
    const socket = new WebSocket(wsUrl);
    ws.value = socket;
    isProbing.value = true;
    error.value = null;

    socket.onopen = () => {
      isConnected.value = true;
      socket.send(JSON.stringify({ action: 'probe', ports: portList }));
    };

    socket.onmessage = event => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'probe-result') {
          const { port, isHttp, url, statusCode } = message;
          probeResults.value = new Map(probeResults.value).set(port, { isHttp, url, statusCode });
        } else if (message.type === 'probe-complete') {
          isProbing.value = false;
          disconnect();
        }
      } catch (err) {
        console.error('Error parsing port probe WebSocket message:', err);
      }
    };

    socket.onerror = () => {
      error.value = 'Port probe WebSocket connection error';
      isConnected.value = false;
      isProbing.value = false;
    };

    socket.onclose = () => {
      isConnected.value = false;
    };
  };

  // Reconnect whenever the port list changes (e.g. after a 5s poll refresh)
  watch(
    ports,
    newPorts => {
      if (newPorts.length > 0) {
        probeResults.value = new Map();
        connect(newPorts);
      }
    },
    { immediate: true }
  );

  onUnmounted(() => {
    disconnect();
  });

  return {
    probeResults,
    isProbing,
    isConnected,
    error,
  };
}
