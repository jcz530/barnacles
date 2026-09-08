<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { useCommandRegistry } from '@/commands/useCommandRegistry';
import type { Command } from '@/commands/types';
import CommandPalette from '@/components/command-palette/organisms/CommandPalette.vue';

// This window has no router of its own, and it stays alive (hidden) between
// invocations, so the registry is always "open" here.
const isOpen = ref(true);
const { commands } = useCommandRegistry(isOpen);
const queryClient = useQueryClient();
const paletteRef = ref<InstanceType<typeof CommandPalette> | null>(null);

const dismiss = () => {
  window.electron.commandPalette.close();
};

/**
 * Navigation can't happen here -- there is no router and no page to show it on.
 * Hand it to a main window instead, creating one if every window is closed.
 */
const navigate = async (path: string) => {
  const result = await window.electron.showOrCreateWindow();
  if (!result?.success) return;
  await window.electron.navigateToProject(path);
  dismiss();
};

const runCommand = async (command: Command) => {
  await command.run({ surface: 'floating', navigate, dismiss });
};

let unsubscribeOpened: (() => void) | undefined;

onMounted(() => {
  document.body.classList.add('command-palette-window');

  // Reopening shows the same long-lived renderer, so its cache would otherwise
  // be as stale as the last time the window was used.
  unsubscribeOpened = window.electron.commandPalette.onOpened(() => {
    // Clearing the query and focusing the input is all that has to happen before
    // the window paints.
    paletteRef.value?.reset();

    // Refetching is deferred past the opening frame. TanStack serves the cached
    // list meanwhile, so the palette is usable immediately; /api/ports shells out
    // to lsof and takes ~150ms, which would otherwise compete with the paint.
    requestAnimationFrame(() => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      void queryClient.invalidateQueries({ queryKey: ['ports'] });
      // Keyed 'process-status-all' when no projectId is passed, which is how the
      // registry queries it; ['project', id, 'process-status'] is the per-project form.
      void queryClient.invalidateQueries({ queryKey: ['process-status-all'] });
    });
  });
});

onUnmounted(() => {
  document.body.classList.remove('command-palette-window');
  unsubscribeOpened?.();
});
</script>

<template>
  <div class="bg-popover/95 supports-[backdrop-filter]:bg-popover/80 h-screen backdrop-blur">
    <CommandPalette
      ref="paletteRef"
      :commands="commands"
      height-class="h-full"
      @select="runCommand"
      @dismiss="dismiss"
    />
  </div>
</template>

<style>
/* The window itself is the surface, so the page behind must not paint one. */
body.command-palette-window,
body.command-palette-window #app {
  background: transparent !important;
  min-height: auto;
  overflow: hidden;
}
</style>
