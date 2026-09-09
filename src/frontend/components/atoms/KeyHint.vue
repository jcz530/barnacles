<script setup lang="ts">
import { computed } from 'vue';
import { acceleratorParts } from '@/utils/accelerator';
import { useIsMac } from '@/composables/useIsMac';
import { cn } from '@/lib/utils';

const props = withDefaults(
  defineProps<{
    /** Electron-style accelerator, e.g. 'CommandOrControl+K'. */
    accelerator: string;
    /**
     * 'md' is the readable default, for a hint someone has to act on. 'sm' is
     * for a chip riding along inside another control, where it is a reminder
     * rather than an instruction.
     */
    size?: 'sm' | 'md';
  }>(),
  { size: 'md' }
);

const isMac = useIsMac();

// Rendered per key rather than as one string: macOS runs its glyphs together,
// which reads as a single dense mark. Spacing them is what makes a combo
// legible as separate keys.
//
// The chip is deliberately larger than the text beside it. Symbols like the
// command and shift glyphs are drawn small within their em box, so at the
// surrounding text size they are a smudge rather than a key you can read --
// and a hint you cannot read precisely is not a hint.
const parts = computed(() => acceleratorParts(props.accelerator, isMac.value));

const sizeClasses = computed(() =>
  props.size === 'sm' ? 'h-5 min-w-5 gap-0.5 px-1.5 text-xs' : 'h-7 min-w-7 gap-1 px-2 text-base'
);
</script>

<template>
  <!--
    Inside a highlighted row the muted chip reads as a stray grey block on the
    primary fill, so it borrows the row's own colour there instead.
  -->
  <kbd
    :class="
      cn(
        'bg-muted text-muted-foreground inline-flex items-center justify-center rounded border font-sans leading-none group-data-[highlighted]:border-current/30 group-data-[highlighted]:bg-transparent group-data-[highlighted]:text-current',
        sizeClasses
      )
    "
  >
    <span v-for="(part, index) in parts" :key="`${index}-${part}`">{{ part }}</span>
  </kbd>
</template>
