<script setup lang="ts">
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { useDebounceFn } from '@vueuse/core';
import { onMounted, onUnmounted, ref, toRef } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { useProcessTerminalWebSocket } from '../../../composables/useProcessTerminalWebSocket';
import '@xterm/xterm/css/xterm.css';

const props = withDefaults(
  defineProps<{
    processId: string;
    /** Render output but refuse keystrokes. */
    readonly?: boolean;
  }>(),
  { readonly: false }
);

const terminalRef = ref<HTMLDivElement>();
const queryClient = useQueryClient();

let terminal: Terminal | null = null;

/** Output that arrived before the terminal was ready. */
const pendingWrites: { data: string; reset: boolean }[] = [];
let fitAddon: FitAddon | null = null;
let resizeObserver: ResizeObserver | null = null;

/** Stop accepting input once the process is gone. */
const freezeInput = () => {
  if (terminal) {
    terminal.options.disableStdin = true;
    terminal.options.cursorBlink = false;
  }
};

const { sendInput, sendResize } = useProcessTerminalWebSocket(toRef(props, 'processId'), {
  onReplay: (data, reset) => {
    // Cannot currently arrive before the terminal exists: the socket's URL
    // stays undefined until useApiPort's own onMounted has awaited the config
    // IPC. Buffer rather than drop anyway, so a future change to that timing
    // cannot silently lose the scrollback.
    if (!terminal) {
      pendingWrites.push({ data, reset });
      return;
    }
    if (reset) {
      // reset(), not clear(): clear() keeps the current viewport line, so a
      // reconnect would leave a half-written line above the replayed buffer
      // and read as duplicated output.
      terminal.reset();
    }
    terminal.write(data);
  },
  onAttached: message => {
    if (message.status !== 'running') {
      // Attaching to a process that already finished: say so, rather than
      // showing a dead pane with no explanation.
      const code = message.exitCode;
      const detail = code === undefined ? message.status : `exited with code ${code}`;
      terminal?.write(`\r\n\x1b[2m[Process ${detail}]\x1b[0m\r\n`);
      freezeInput();
    }
    // Our geometry is authoritative from the moment we attach; the process may
    // have been spawned before any terminal existed.
    pushSize();
  },
  onOutput: data => {
    if (!terminal) {
      pendingWrites.push({ data, reset: false });
      return;
    }
    terminal.write(data);
  },
  onRefused: reason => {
    // No PTY behind this id (a demo fixture, or a process the backend forgot).
    // Say so rather than leaving an empty black pane.
    terminal?.write(`\r\n\x1b[2m[${reason}]\x1b[0m\r\n`);
    freezeInput();
  },
  onExit: exitCode => {
    terminal?.write(`\r\n\x1b[2m[Process exited with code ${exitCode}]\x1b[0m\r\n`);
    freezeInput();
    // The status badge polls on a 5s interval; nudge it so a process the user
    // just killed does not linger as "running".
    queryClient.invalidateQueries({ queryKey: ['processes'] });
  },
});

/** Report the current grid size to the PTY. */
const pushSize = () => {
  if (terminal) {
    sendResize(terminal.cols, terminal.rows);
  }
};

// Dragging a window edge fires a burst of resizes; only the last one matters.
const pushSizeDebounced = useDebounceFn(pushSize, 100);

const initTerminal = () => {
  if (!terminalRef.value) return;

  terminal = new Terminal({
    cursorBlink: !props.readonly,
    disableStdin: props.readonly,
    fontSize: 13,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    scrollback: 10000,
    theme: {
      background: '#00000000',
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

  fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.loadAddon(new WebLinksAddon());

  terminal.open(terminalRef.value);
  fitAddon.fit();

  // xterm already encodes keystrokes, pastes, and control sequences (Ctrl-C
  // arrives as \x03), so the bytes can go straight to the PTY.
  if (!props.readonly) {
    terminal.onData(data => sendInput(data));
  }

  terminal.onResize(() => pushSizeDebounced());

  for (const write of pendingWrites.splice(0)) {
    if (write.reset) {
      terminal.reset();
    }
    terminal.write(write.data);
  }

  resizeObserver = new ResizeObserver(() => {
    fitAddon?.fit();
  });
  resizeObserver.observe(terminalRef.value);
};

const cleanup = () => {
  resizeObserver?.disconnect();
  resizeObserver = null;
  terminal?.dispose();
  terminal = null;
  fitAddon = null;
};

onMounted(() => {
  initTerminal();
});

onUnmounted(() => {
  cleanup();
});
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
