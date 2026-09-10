<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import {
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  VisuallyHidden,
} from 'reka-ui';
import { useRouter } from 'vue-router';
import { useCommandRegistry } from '@/commands/useCommandRegistry';
import type { Command } from '@/commands/types';
import { runCommand } from '@/commands/run-command';
import CommandPalette from './CommandPalette.vue';

const open = defineModel<boolean>('open', { required: true });

const router = useRouter();
const { commands, resetLazyState } = useCommandRegistry(open);
const paletteRef = ref<InstanceType<typeof CommandPalette> | null>(null);

// A fresh search each time it opens. Awaits the render: the palette lives
// inside DialogPortal, so on the first open the child does not exist yet when
// this fires and the reset would be silently dropped.
watch(open, async isOpen => {
  if (!isOpen) return;
  // Lazily-fetched process lists are held in the registry, which lives as long
  // as this dialog does -- so drop them rather than showing what was configured
  // the last time the palette was opened.
  resetLazyState();
  await nextTick();
  paletteRef.value?.reset();
});

const onSelect = (command: Command) =>
  runCommand(command, () => ({
    surface: 'in-app',
    navigate: async path => {
      open.value = false;
      await router.push(path);
    },
    dismiss: () => {
      open.value = false;
    },
    // The palette owns both -- it holds the level stack and renders the status
    // line -- so a command that stays open reports back into it.
    pop: () => paletteRef.value?.popLevel(),
    status: (message, kind) => paletteRef.value?.report(message, kind),
  }));
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <!--
        Above the title bar's z-1000, so the dim covers the whole window. At
        z-50 the bar sat on top of it and stayed bright while everything else
        dimmed, which read as the overlay stopping short of the top.
      -->
      <DialogOverlay
        class="data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-[1100] bg-slate-950/50"
      />
      <!--
        Not ui/dialog's DialogContent: that hardcodes sm:max-w-lg and always
        renders a close X, neither of which suits a palette.
      -->
      <!--
        Escape closes this dialog through reka's dismissable layer, which
        listens on the window and dismisses only if nothing already handled the
        key. That is how backing out of an item's actions takes precedence: the
        palette marks the event handled and the layer leaves the dialog open.
      -->
      <DialogContent
        class="bg-popover data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 fixed top-[20%] left-1/2 z-[1101] w-[92vw] max-w-2xl -translate-x-1/2 overflow-hidden rounded-xl border shadow-2xl"
      >
        <!-- Reka warns when a dialog has no title or description to announce. -->
        <VisuallyHidden>
          <DialogTitle>Command palette</DialogTitle>
          <DialogDescription>
            Search projects, ports, processes, and pages, then press Enter to run a command.
          </DialogDescription>
        </VisuallyHidden>
        <CommandPalette
          ref="paletteRef"
          :commands="commands"
          @select="onSelect"
          @dismiss="open = false"
        />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
