import { computed, type Ref } from 'vue';
import { useWebSocket } from '@vueuse/core';
import { API_ROUTES } from '../../shared/constants';
import { useApiPort } from './useApiPort';

/** Messages the server sends a terminal. */
type ProcessSocketMessage =
  | { type: 'replay'; data: string; seq: number; reset: boolean }
  | {
      type: 'attached';
      processId: string;
      status: 'running' | 'stopped' | 'failed';
      exitCode?: number;
      cols: number;
      rows: number;
      seq: number;
    }
  | { type: 'output'; data: string; seq: number }
  | { type: 'exit'; exitCode: number }
  | { type: 'error'; message: string }
  | { type: 'pong' };

interface Handlers {
  /** Scrollback replayed on attach; `reset` means clear before writing. */
  onReplay: (data: string, reset: boolean) => void;
  onAttached: (message: Extract<ProcessSocketMessage, { type: 'attached' }>) => void;
  onOutput: (data: string) => void;
  onExit: (exitCode: number) => void;
}

/**
 * Live connection to one process's PTY: streams its output and carries
 * keystrokes back.
 *
 * The URL is a computed that stays null until the API port and token have
 * arrived over IPC, so we never dial the default port with an empty token;
 * VueUse reopens the socket by itself once it resolves, and again whenever the
 * process changes.
 */
export function useProcessTerminalWebSocket(processId: Ref<string | null>, handlers: Handlers) {
  const { wsBaseUrl, wsToken, isLoaded } = useApiPort();

  /** Highest seq seen, so a gap in the stream is detectable. */
  let lastSeq = 0;

  const wsUrl = computed(() => {
    if (!isLoaded.value || !wsToken.value || !processId.value) {
      return undefined;
    }
    const params = new URLSearchParams({ id: processId.value, token: wsToken.value });
    return `${wsBaseUrl.value}${API_ROUTES.PROCESS_WS}?${params.toString()}`;
  });

  const { status, send, close, open } = useWebSocket(wsUrl, {
    // A terminal is long-lived, and replay-on-attach makes reconnecting
    // lossless, so unlike the other sockets in this app it is worth retrying.
    autoReconnect: { retries: 5, delay: 1000 },
    onMessage: (_ws, event) => {
      let message: ProcessSocketMessage;
      try {
        message = JSON.parse(event.data);
      } catch {
        console.error('Malformed process terminal message');
        return;
      }

      switch (message.type) {
        case 'replay':
          lastSeq = message.seq;
          handlers.onReplay(message.data, message.reset);
          break;

        case 'attached':
          handlers.onAttached(message);
          break;

        case 'output':
          // A gap means the buffer moved on without us; worth knowing about,
          // but the bytes we did get are still correct to paint.
          if (message.seq !== lastSeq + 1) {
            console.warn(
              `Process output gap: expected seq ${lastSeq + 1}, received ${message.seq}`
            );
          }
          lastSeq = message.seq;
          handlers.onOutput(message.data);
          break;

        case 'exit':
          handlers.onExit(message.exitCode);
          break;

        case 'error':
          console.error('Process terminal error:', message.message);
          break;

        case 'pong':
          break;
      }
    },
  });

  const isConnected = computed(() => status.value === 'OPEN');

  /** Send a keystroke (or pasted text) to the PTY. */
  const sendInput = (data: string): void => {
    send(JSON.stringify({ action: 'input', data }));
  };

  /** Tell the PTY how big this terminal is. */
  const sendResize = (cols: number, rows: number): void => {
    send(JSON.stringify({ action: 'resize', cols, rows }));
  };

  return { isConnected, status, sendInput, sendResize, close, open };
}
