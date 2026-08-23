<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue';
import { useElementSize } from '@vueuse/core';
import type { ShareSize } from '@shared/share/share-model';
import { SIZES } from '../../../utils/share-card';

/**
 * Shows the share card at display scale.
 *
 * The card is rendered into a sandboxed iframe from the *same* HTML string that
 * gets rasterized, rather than being rebuilt as Vue components. That costs an
 * iframe but makes the preview WYSIWYG by construction — there is no second
 * implementation that can drift from the exported PNG.
 */
const props = defineProps<{
  html: string;
  size: ShareSize;
}>();

const frame = useTemplateRef<HTMLElement>('wrapper');
const { width: available } = useElementSize(frame);

const dimensions = computed(() => SIZES[props.size]);

/**
 * Ceiling on the preview's height.
 *
 * Scaling on width alone makes the square card about 700px tall, which pushes
 * the controls below it out of view before the dialog can scroll.
 */
const MAX_PREVIEW_HEIGHT = 320;

// The card is laid out at full size and scaled down to fit, so the preview is
// a faithful miniature rather than a reflowed layout.
const scale = computed(() => {
  if (!available.value) return 0;
  return Math.min(
    1,
    available.value / dimensions.value.width,
    MAX_PREVIEW_HEIGHT / dimensions.value.height
  );
});

const scaledHeight = computed(() => dimensions.value.height * scale.value);
// A height-capped card is narrower than the container, so centre it rather
// than leaving it pinned to the left with dead space beside it.
const scaledWidth = computed(() => dimensions.value.width * scale.value);

// srcdoc rather than a src URL: the document is self-contained, and this keeps
// it out of session history.
const srcdoc = ref(props.html);
watch(
  () => props.html,
  value => {
    srcdoc.value = value;
  }
);
</script>

<template>
  <div ref="wrapper" class="w-full">
    <div
      class="relative mx-auto overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800"
      :style="{ height: `${scaledHeight}px`, width: `${scaledWidth}px` }"
    >
      <iframe
        :srcdoc="srcdoc"
        title="Share card preview"
        sandbox=""
        scrolling="no"
        class="pointer-events-none absolute top-0 left-0 origin-top-left border-0"
        :style="{
          width: `${dimensions.width}px`,
          height: `${dimensions.height}px`,
          transform: `scale(${scale})`,
        }"
      />
    </div>
  </div>
</template>
