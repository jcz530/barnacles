import { useDebounceFn, useWebSocket } from '@vueuse/core';
import { computed, ref, watch } from 'vue';
import type { Ref } from 'vue';
import { useApiPort } from './useApiPort';

interface ProbeResult {
  isHttp: boolean;
  url: string;
  captureUrl: string;
  statusCode: number | null;
  signature: string | null;
  cachedScreenshot: { fileName: string; capturedAt: string } | null;
}

export interface ProbeTarget {
  port: number;
  processName: string;
}

export function usePortProbeWebSocket(targets: Ref<ProbeTarget[]>) {
  const isProbing = ref(false);
  const error = ref<string | null>(null);
  const probeResults = ref<Map<number, ProbeResult>>(new Map());

  const { wsBaseUrl } = useApiPort();
  const wsUrl = computed(() => `${wsBaseUrl.value}/api/ports/probe/ws`);

  const { status, send, open } = useWebSocket(wsUrl, {
    immediate: false,
    autoConnect: false,
    autoReconnect: false,
    onMessage: (_ws, event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'probe-result') {
          const { port, isHttp, url, captureUrl, statusCode, signature, cachedScreenshot } =
            message;
          probeResults.value = new Map(probeResults.value).set(port, {
            isHttp,
            url,
            captureUrl,
            statusCode,
            signature,
            cachedScreenshot,
          });
        } else if (message.type === 'probe-complete') {
          isProbing.value = false;
        }
      } catch (err) {
        console.error('Error parsing port probe WebSocket message:', err);
      }
    },
    onError: () => {
      error.value = 'Port probe WebSocket connection error';
      isProbing.value = false;
    },
  });

  const isConnected = computed(() => status.value === 'OPEN');

  const sendProbe = (probeTargets: ProbeTarget[]) => {
    isProbing.value = true;
    send(JSON.stringify({ action: 'probe', targets: probeTargets }));
  };

  const handleTargetsChange = useDebounceFn((newTargets: ProbeTarget[]) => {
    const newPorts = new Set(newTargets.map(t => t.port));

    // Drop results for ports no longer present, keep the rest untouched
    let removedAny = false;
    const next = new Map(probeResults.value);
    for (const port of next.keys()) {
      if (!newPorts.has(port)) {
        next.delete(port);
        removedAny = true;
      }
    }
    if (removedAny) probeResults.value = next;

    const added = newTargets.filter(t => !probeResults.value.has(t.port));
    if (added.length === 0) return;

    error.value = null;
    if (status.value === 'CLOSED') {
      open();
    }
    // useWebSocket buffers send() until the connection is OPEN, so this is
    // safe to call immediately after open() too.
    sendProbe(added);
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

  return {
    probeResults,
    isProbing,
    isConnected,
    error,
  };
}
