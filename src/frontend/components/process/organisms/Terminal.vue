<script setup lang="ts">
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { RUNTIME_CONFIG } from '../../../../shared/constants';

const props = defineProps<{
  terminalId: string;
}>();

const terminalRef = ref<HTMLDivElement>();
let terminal: Terminal | null = null;
let fitAddon: FitAddon | null = null;
let ws: WebSocket | null = null;

const initTerminal = () => {
  if (!terminalRef.value) return;

  // Create terminal instance
  terminal = new Terminal({
    cursorBlink: true,
    fontSize: 13,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    theme: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#d4d4d4',
      black: '#000000',
      red: '#cd3131',
      green: '#0dbc79',
      yellow: '#e5e510',
      blue: '#2472c8',
      magenta: '#bc3fbc',
      cyan: '#11a8cd',
      white: '#e5e5e5',
      brightBlack: '#666666',
      brightRed: '#f14c4c',
      brightGreen: '#23d18b',
      brightYellow: '#f5f543',
      brightBlue: '#3b8eea',
      brightMagenta: '#d670d6',
      brightCyan: '#29b8db',
      brightWhite: '#ffffff',
    },
  });

  // Add addons
  fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.loadAddon(new WebLinksAddon());

  // Open terminal in the container
  terminal.open(terminalRef.value);

  // Fit terminal to container
  fitAddon.fit();

  // Connect to WebSocket
  connectWebSocket();

  // Handle terminal input
  terminal.onData(data => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });

  // Handle window resize
  const resizeObserver = new ResizeObserver(() => {
    fitAddon?.fit();
  });

  if (terminalRef.value) {
    resizeObserver.observe(terminalRef.value);
  }

  return () => {
    resizeObserver.disconnect();
  };
};

const connectWebSocket = () => {
  const wsUrl = RUNTIME_CONFIG.API_BASE_URL.replace('http', 'ws');
  ws = new WebSocket(`${wsUrl}/api/terminals/ws?id=${props.terminalId}`);

  // ws.onopen = () => {
  // console.log('WebSocket connected');
  // };

  ws.onmessage = event => {
    if (terminal) {
      terminal.write(event.data);
    }
  };

  ws.onclose = () => {
    // console.log('WebSocket closed');
    if (terminal) {
      terminal.write('\r\n[Connection closed]\r\n');
    }
  };

  ws.onerror = error => {
    // console.error('WebSocket error:', error);
    if (terminal) {
      terminal.write('\r\n[Connection error]\r\n');
    }
  };
};

const cleanup = () => {
  if (ws) {
    ws.close();
    ws = null;
  }
  if (terminal) {
    terminal.dispose();
    terminal = null;
  }
  fitAddon = null;
};

onMounted(() => {
  initTerminal();
});

onUnmounted(() => {
  cleanup();
});

// Reconnect if terminal ID changes
watch(
  () => props.terminalId,
  () => {
    cleanup();
    initTerminal();
  }
);
</script>

<template>
  <div ref="terminalRef" class="h-full w-full"></div>
</template>

<style scoped>
/* Ensure the terminal container fills its parent */
div {
  min-height: 0;
}
</style>
