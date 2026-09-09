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
  <!--
    Inside a highlighted row the muted chip reads as a stray grey block on the
    primary fill, so it borrows the row's own colour there instead.
  -->
  <kbd
    class="bg-muted text-muted-foreground inline-flex h-5 min-w-5 items-center justify-center rounded border px-1.5 font-sans text-[11px] leading-none group-data-[highlighted]:border-current/30 group-data-[highlighted]:bg-transparent group-data-[highlighted]:text-current"
  >
    {{ label }}
  </kbd>
</template>
