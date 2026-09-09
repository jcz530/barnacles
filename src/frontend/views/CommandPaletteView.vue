<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useQueryClient } from '@tanstack/vue-query';
import { useCommandRegistry } from '@/commands/useCommandRegistry';
import type { Command } from '@/commands/types';
import CommandPalette from '@/components/command-palette/organisms/CommandPalette.vue';

// This window has no router of its own, and it stays alive (hidden) between
// invocations, so the registry is always "open" here.
const isOpen = ref(true);
const { commands, resetLazyState } = useCommandRegistry(isOpen);
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
  // An item can carry actions instead of a default verb, in which case the
  // palette opens its level rather than emitting it here.
  if (!command.run) return;

  await command.run({ surface: 'floating', navigate, dismiss });
};

/**
 * Tell the main process how deep the action stack is.
 *
 * Escape is intercepted there, before this renderer sees it, so without this
 * it would close the window even when the person meant to back out one level.
 */
const reportDepth = (depth: number) => {
  window.electron.commandPalette.setDepth(depth);
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
    // Configured processes are fetched lazily and kept in the registry, which
    // outlives an open along with this window -- so a reopen must not serve the
    // list from the last time it was used.
    resetLazyState();

    // Refetching is deferred past the opening frame. TanStack serves the cached
    // list meanwhile, so the palette is usable immediately; /api/ports shells out
    // to lsof and takes ~150ms, which would otherwise compete with the paint.
    requestAnimationFrame(() => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      void queryClient.invalidateQueries({ queryKey: ['ports'] });
      // Keyed 'process-status-all' when no projectId is passed, which is how the
      // registry queries it; ['project', id, 'process-status'] is the per-project form.
      void queryClient.invalidateQueries({ queryKey: ['process-status-all'] });
      // Prefix-matches every ['project', id, ...] key, so a project's configured
      // processes are refetched too -- they have a five-minute staleTime, long
      // enough that a process added in the app would not otherwise show up here.
      void queryClient.invalidateQueries({ queryKey: ['project'] });
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
      @depth-change="reportDepth"
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
