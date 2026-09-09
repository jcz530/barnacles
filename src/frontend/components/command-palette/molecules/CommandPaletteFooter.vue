<script setup lang="ts">
import { computed } from 'vue';
import { ChevronRight } from 'lucide-vue-next';
import type { PaletteItem } from '@/commands/types';
import KeyHint from '@/components/atoms/KeyHint.vue';
import ProjectIcon from '@/components/projects/atoms/ProjectIcon.vue';

/** One step of the trail back to the root, as the footer renders it. */
export interface Crumb {
  title: string;
  projectIcon?: PaletteItem['projectIcon'];
  icon?: PaletteItem['icon'];
}

const props = defineProps<{
  /** Open levels, outermost first. Empty at the root. */
  breadcrumb: Crumb[];
  /** Names what Enter does on the highlighted row. */
  primaryLabel?: string | null;
  /** Whether the highlighted row has an actions level to open. */
  hasActions: boolean;
}>();

// Always renders something: letting this collapse when nothing is highlighted
// would make the palette change height as the cursor moves.
const label = computed(() => props.primaryLabel || 'Select');
</script>

<template>
  <div
    class="text-muted-foreground flex h-10 shrink-0 items-center justify-between gap-3 border-t px-3 text-xs"
  >
    <div class="flex min-w-0 items-center gap-1.5">
      <template v-for="(crumb, index) in breadcrumb" :key="`${index}-${crumb.title}`">
        <ChevronRight v-if="index > 0" class="size-3 shrink-0 opacity-50" />
        <!--
          The same icon the row carried, so a level reads as belonging to the
          thing it was opened from rather than as a bare name.
        -->
        <ProjectIcon
          v-if="crumb.projectIcon"
          v-bind="crumb.projectIcon"
          size="sm"
          class="shrink-0"
        />
        <component :is="crumb.icon" v-else-if="crumb.icon" class="size-3.5 shrink-0 opacity-70" />
        <span class="truncate" :class="{ 'text-foreground': index === breadcrumb.length - 1 }">
          {{ crumb.title }}
        </span>
      </template>
    </div>

    <div class="flex shrink-0 items-center gap-2">
      <span class="flex items-center gap-1.5">
        {{ label }}
        <KeyHint accelerator="Return" />
      </span>

      <template v-if="hasActions">
        <span class="bg-border h-4 w-px" aria-hidden="true" />
        <span class="flex items-center gap-1.5">
          Actions
          <KeyHint accelerator="CommandOrControl+K" />
        </span>
      </template>
    </div>
  </div>
</template>
