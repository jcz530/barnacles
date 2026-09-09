<script setup lang="ts">
import { computed } from 'vue';
import { formatAccelerator } from '@/utils/accelerator';
import { useIsMac } from '@/composables/useIsMac';

const props = defineProps<{
  /** Electron-style accelerator, e.g. 'CommandOrControl+K'. */
  accelerator: string;
}>();

const isMac = useIsMac();

// Renders as glyphs on macOS and words elsewhere, so one stored accelerator
// reads correctly on every platform.
const label = computed(() => formatAccelerator(props.accelerator, isMac.value));
</script>

<template>
  <kbd
    class="bg-muted text-muted-foreground inline-flex h-5 min-w-5 items-center justify-center rounded border px-1.5 font-sans text-[11px] leading-none"
  >
    {{ label }}
  </kbd>
</template>
