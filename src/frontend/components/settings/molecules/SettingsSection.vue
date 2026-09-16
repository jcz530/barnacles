<script setup lang="ts">
/*
 * A settings section: the heading the sidebar navigates to, plus its settings.
 *
 * The heading is deliberately two steps above the setting labels inside it
 * (text-lg semibold against text-sm medium). The old page used `CardTitle`,
 * which carries no explicit size, so section titles landed at the same size as
 * the labels beneath them and the page had no visible structure to skim.
 */
defineProps<{
  id: string;
  title: string;
  description?: string;
}>();

/*
 * No mount-time emit handing the anchor element to the page.
 *
 * A filtered section that survives a search is *patched* rather than remounted,
 * so `onMounted` never fires again and the page would be left holding no
 * observer for it -- scroll-spy went dead for exactly the sections a search
 * kept. The page now looks its anchors up by id after each render instead,
 * which sees patched, added and removed sections alike.
 */
</script>

<template>
  <!--
    scroll-mt-14 (56px) keeps a clicked heading clear of the title bar. That bar
    is `fixed` at h-10 (40px) over the top of the viewport, so a heading scrolled
    to `block: 'start'` lands underneath it; the remaining 16px is breathing room
    above the heading rather than butting it against the chrome.
  -->
  <section :id="id" class="relative scroll-mt-14">
    <!--
      Scroll-spy marker: a zero-height line at the very top of the section.
      The spy watches this rather than the <section> box, so the sidebar
      switches when the heading reaches the trigger line instead of when the
      previous section's last row finally clears it -- a section box spans its
      whole height, so the old arrangement made the switch depend on how tall
      the outgoing section was. `aria-hidden` and no size: it is a coordinate,
      not content.
    -->
    <div
      :data-section-marker="id"
      class="pointer-events-none absolute inset-x-0 top-0 h-px"
      aria-hidden="true"
    ></div>

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
