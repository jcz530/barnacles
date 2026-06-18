import { useDebounceFn } from '@vueuse/core';
import { onUnmounted, ref, watch } from 'vue';
import type { Ref } from 'vue';
import { useApiPort } from './useApiPort';

interface ProbeResult {
  isHttp: boolean;
  url: string;
  statusCode: number | null;
  signature: string | null;
  cachedScreenshot: { fileName: string; capturedAt: string } | null;
}

export interface ProbeTarget {
  port: number;
  processName: string;
}

export function usePortProbeWebSocket(targets: Ref<ProbeTarget[]>) {
  const ws = ref<WebSocket | null>(null);
  const isConnected = ref(false);
  const isProbing = ref(false);
  const error = ref<string | null>(null);
  const probeResults = ref<Map<number, ProbeResult>>(new Map());
  const knownPorts = new Set<number>();

  const { wsBaseUrl, isLoaded, loadApiPort } = useApiPort();

  const disconnect = () => {
    if (ws.value) {
      ws.value.close();
      ws.value = null;
    }
    isConnected.value = false;
    isProbing.value = false;
  };

  const sendProbe = (probeTargets: ProbeTarget[]) => {
    ws.value?.send(JSON.stringify({ action: 'probe', targets: probeTargets }));
  };

  const connect = async (probeTargets: ProbeTarget[]) => {
    if (probeTargets.length === 0) return;

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
      sendProbe(probeTargets);
    };

    socket.onmessage = event => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'probe-result') {
          const { port, isHttp, url, statusCode, signature, cachedScreenshot } = message;
          probeResults.value = new Map(probeResults.value).set(port, {
            isHttp,
            url,
            statusCode,
            signature,
            cachedScreenshot,
          });
          knownPorts.add(port);
        } else if (message.type === 'probe-complete') {
          isProbing.value = false;
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

  const handleTargetsChange = useDebounceFn((newTargets: ProbeTarget[]) => {
    const newPorts = new Set(newTargets.map(t => t.port));

    // Drop results for ports no longer present, keep the rest untouched
    let removedAny = false;
    const next = new Map(probeResults.value);
    for (const port of next.keys()) {
      if (!newPorts.has(port)) {
        next.delete(port);
        knownPorts.delete(port);
        removedAny = true;
      }
    }
    if (removedAny) probeResults.value = next;

    const added = newTargets.filter(t => !knownPorts.has(t.port));
    if (added.length === 0) return;

    if (isConnected.value && ws.value) {
      isProbing.value = true;
      sendProbe(added);
    } else {
      connect(newTargets);
    }
  }, 300);

  watch(
    targets,
    newTargets => {
      if (newTargets.length > 0) {
        handleTargetsChange(newTargets);
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
