<script setup lang="ts">
import { computed } from 'vue';
import { acceleratorParts } from '@/utils/accelerator';
import { useIsMac } from '@/composables/useIsMac';

const props = defineProps<{
  /** Electron-style accelerator, e.g. 'CommandOrControl+K'. */
  accelerator: string;
}>();

const isMac = useIsMac();

// Rendered per key rather than as one string: macOS runs its glyphs together,
// which at this size reads as a single dense mark. Spacing them is what makes
// a combo legible as separate keys.
const parts = computed(() => acceleratorParts(props.accelerator, isMac.value));
</script>

<template>
  <!--
    Inside a highlighted row the muted chip reads as a stray grey block on the
    primary fill, so it borrows the row's own colour there instead.
  -->
  <kbd
    class="bg-muted text-muted-foreground inline-flex h-6 min-w-6 items-center justify-center gap-0.5 rounded border px-1.5 font-sans text-sm leading-none group-data-[highlighted]:border-current/30 group-data-[highlighted]:bg-transparent group-data-[highlighted]:text-current"
  >
    <span v-for="(part, index) in parts" :key="`${index}-${part}`">{{ part }}</span>
  </kbd>
</template>
