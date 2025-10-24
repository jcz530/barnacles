<script setup lang="ts">
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { onMounted, onUnmounted, ref, watch } from 'vue';
import '@xterm/xterm/css/xterm.css';

/* global ResizeObserver, HTMLDivElement */

const props = defineProps<{
  output: string;
}>();

const terminalRef = ref<HTMLDivElement>();
let terminal: Terminal | null = null;
let fitAddon: FitAddon | null = null;
let lastOutput = '';

const initTerminal = () => {
  if (!terminalRef.value) return;

  // Create terminal instance (read-only)
  terminal = new Terminal({
    cursorBlink: false,
    disableStdin: true,
    fontSize: 13,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    scrollback: 10000,
    theme: {
      background: '#00000000',
      foreground: '#d4d4d4',
      cursor: '#1e1e1e', // Hide cursor
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

  // Fit terminal to container and write initial output
  fitAddon?.fit();

  // Write initial output after terminal is properly sized
  if (props.output) {
    terminal?.write(props.output);
    lastOutput = props.output;
  }

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

const cleanup = () => {
  if (terminal) {
    terminal.dispose();
    terminal = null;
  }
  fitAddon = null;
  lastOutput = '';
};

onMounted(() => {
  initTerminal();
});

onUnmounted(() => {
  cleanup();
});

// Watch for output changes and write new content
watch(
  () => props.output,
  newOutput => {
    if (!terminal) return;

    // If output is completely different, clear and rewrite
    if (!newOutput.startsWith(lastOutput)) {
      terminal.clear();
      terminal.write(newOutput);
      lastOutput = newOutput;
    } else {
      // Only write the new part
      const newContent = newOutput.slice(lastOutput.length);
      if (newContent) {
        terminal.write(newContent);
        lastOutput = newOutput;
      }
    }
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
