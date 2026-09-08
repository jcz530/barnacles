<script setup lang="ts">
import { ref, watch } from 'vue';
import { DialogContent, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from 'reka-ui';
import { VisuallyHidden } from 'reka-ui';
import { useRouter } from 'vue-router';
import { useCommandRegistry } from '@/commands/useCommandRegistry';
import type { Command } from '@/commands/types';
import CommandPalette from './CommandPalette.vue';

const open = defineModel<boolean>('open', { required: true });

const router = useRouter();
const { commands } = useCommandRegistry(open);
const paletteRef = ref<InstanceType<typeof CommandPalette> | null>(null);

// A fresh search each time it opens.
watch(open, isOpen => {
  if (isOpen) paletteRef.value?.reset();
});

const runCommand = async (command: Command) => {
  await command.run({
    surface: 'in-app',
    navigate: async path => {
      open.value = false;
      await router.push(path);
    },
    dismiss: () => {
      open.value = false;
    },
  });
};
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <DialogOverlay
        class="data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-slate-950/50"
      />
      <!--
        Not ui/dialog's DialogContent: that hardcodes sm:max-w-lg and always
        renders a close X, neither of which suits a palette.
      -->
      <DialogContent
        class="bg-popover data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 fixed top-[20%] left-1/2 z-50 w-[92vw] max-w-2xl -translate-x-1/2 overflow-hidden rounded-xl border shadow-2xl"
      >
        <VisuallyHidden>
          <DialogTitle>Command palette</DialogTitle>
        </VisuallyHidden>
        <CommandPalette
          ref="paletteRef"
          :commands="commands"
          @select="runCommand"
          @dismiss="open = false"
        />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
