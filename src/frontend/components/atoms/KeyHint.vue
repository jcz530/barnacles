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

// leading-none rides along with the size rather than sitting in the base
// string: tailwind-merge groups line-height with font-size, so a text-* class
// arriving later evicts it and the chip's glyphs drift off-centre inside their
// fixed height.
const sizeClasses = computed(() =>
  props.size === 'sm'
    ? 'h-5 min-w-5 gap-0.5 px-1.5 leading-none'
    : 'h-7 min-w-7 gap-1 px-2 leading-none'
);

/*
 * Glyphs and letters are sized apart.
 *
 * The command and arrow glyphs are drawn nearly the full height of their em
 * box, where a letter leaves ascender space above it. At one size the glyph
 * reads correctly and the letter next to it looks oversized -- so the letter
 * drops a step and the glyph keeps the size that made it legible.
 */
const glyphClass = computed(() => (props.size === 'sm' ? 'text-xs' : 'text-base'));
// One step down from the glyph on the large chip. The small one is already at
// the bottom of the scale, so both parts stay there.
const letterClass = 'text-xs';
</script>

<template>
  <!--
    Inside a highlighted row the muted chip reads as a stray grey block on the
    primary fill, so it borrows the row's own colour there instead.
  -->
  <kbd
    :class="
      cn(
        'bg-muted text-muted-foreground inline-flex items-center justify-center rounded border font-sans group-data-[highlighted]:border-current/30 group-data-[highlighted]:bg-transparent group-data-[highlighted]:text-current',
        sizeClasses
      )
    "
  >
    <span
      v-for="(part, index) in parts"
      :key="`${index}-${part.text}`"
      :class="part.symbol ? glyphClass : letterClass"
      >{{ part.text }}</span
    >
  </kbd>
</template>
