<script setup lang="ts">
import { computed } from 'vue';
import { Button } from '@/components/ui/button';

const props = defineProps<{
  selectionCount: number;
  /** Rows currently in the table (after any active filter). */
  totalCount: number;
  /** Whether every row currently visible is selected. */
  allVisibleSelected: boolean;
  /**
   * Render as an absolutely-positioned overlay filling its container, instead
   * of in-flow. Used when teleported into a results row so the bar covers the
   * results count rather than pushing the page down.
   */
  overlay?: boolean;
}>();

const emit = defineEmits<{
  clear: [];
  selectAll: [];
}>();

// Every row is loaded, so "all" simply means every row currently in the table.
// There is no server-side superset to offer beyond it.
const canOfferSelectAll = computed(
  () => props.allVisibleSelected && props.selectionCount < props.totalCount
);

const selectionText = computed(() => {
  if (props.totalCount > 0 && props.selectionCount === props.totalCount) {
    return `All ${props.totalCount} selected`;
  }
  return `${props.selectionCount} of ${props.totalCount} selected`;
});
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-200 ease-out"
    enter-from-class="opacity-0 -translate-y-2"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition-all duration-150 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 -translate-y-2"
  >
    <div
      v-if="selectionCount > 0"
      class="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-200 px-4 py-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
      :class="overlay ? 'absolute inset-0 z-10' : ''"
    >
      <div class="flex flex-wrap items-center gap-3">
        <span class="text-sm font-medium text-slate-900">
          {{ selectionText }}
        </span>
        <Button
          v-if="canOfferSelectAll"
          variant="link"
          size="sm"
          class="h-auto p-0"
          @click="emit('selectAll')"
        >
          Select all {{ totalCount }}
        </Button>
        <Button variant="link" size="sm" class="h-auto p-0" @click="emit('clear')">
          Clear selection
        </Button>
      </div>
      <div class="flex flex-wrap gap-2">
        <slot name="actions" />
      </div>
    </div>
  </Transition>
</template>
