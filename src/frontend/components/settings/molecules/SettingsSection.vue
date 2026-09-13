<script setup lang="ts">
import { onMounted, ref } from 'vue';

/*
 * A settings section: the heading the sidebar navigates to, plus its settings.
 *
 * The heading is deliberately two steps above the setting labels inside it
 * (text-lg semibold against text-sm medium). The old page used `CardTitle`,
 * which carries no explicit size, so section titles landed at the same size as
 * the labels beneath them and the page had no visible structure to skim.
 */
const props = defineProps<{
  id: string;
  title: string;
  description?: string;
}>();

const el = ref<HTMLElement | null>(null);

const emit = defineEmits<{ mounted: [id: string, el: HTMLElement] }>();

// Hands the anchor element up to the page, which owns the scroll-spy observer.
onMounted(() => {
  if (el.value) emit('mounted', props.id, el.value);
});
</script>

<template>
  <!--
    scroll-mt-14 (56px) keeps a clicked heading clear of the title bar. That bar
    is `fixed` at h-10 (40px) over the top of the viewport, so a heading scrolled
    to `block: 'start'` lands underneath it; the remaining 16px is breathing room
    above the heading rather than butting it against the chrome.
  -->
  <section :id="id" ref="el" class="scroll-mt-14">
    <div class="border-border border-b pb-3">
      <h2 class="text-lg font-semibold tracking-tight">{{ title }}</h2>
      <p v-if="description" class="text-muted-foreground mt-1 text-sm">{{ description }}</p>
    </div>

    <!-- Generous row rhythm: these rows are the reason the page exists, and
         crowding them is what made the old card layout hard to scan. -->
    <div class="divide-border divide-y">
      <slot />
    </div>
  </section>
</template>
