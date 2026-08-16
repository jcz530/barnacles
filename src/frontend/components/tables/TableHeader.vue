<script setup lang="ts" generic="TData extends RowData">
import type { Header, HeaderGroup, RowData } from '@tanstack/vue-table';
import { FlexRender } from '@tanstack/vue-table';
import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-vue-next';
import { useSlots } from 'vue';
import type { DataTableFeatures } from './features';

const props = defineProps<{
  headerGroups: HeaderGroup<DataTableFeatures, TData>[];
  columnClasses?: Record<string, string>;
}>();

// Covers both the per-column 'header-<id>' slots and 'header-expander', which
// renders a fixed leading column rather than a real table header and so is
// invoked without props — hence the optional argument.
defineSlots<{
  [key: `header-${string}`]: (props?: {
    header: Header<DataTableFeatures, TData, unknown>;
  }) => unknown;
}>();

const slots = useSlots();

/**
 * Header labels sit in a flex row (so the sort chevron can sit beside them),
 * and a flex container packs its children at the start regardless of
 * `text-align`. That means a column marked `text-right` in `columnClasses`
 * right-aligns its *cells* while its *header* stays stuck on the left — the
 * label ends up nowhere near the numbers it names.
 *
 * Mirroring the column's alignment onto the flex container keeps the two in
 * the same place. It reads the existing class rather than taking a new prop so
 * every call site that already marks its numeric columns is fixed without
 * touching them.
 */
function justifyFor(columnId: string): string | undefined {
  const classes = props.columnClasses?.[columnId];
  if (!classes) return undefined;

  // Word-boundary matched so `text-right` is not found inside `text-nowrap`
  // or a colour like `text-slate-500`.
  const tokens = classes.split(/\s+/);
  if (tokens.includes('text-right')) return 'justify-end';
  if (tokens.includes('text-center')) return 'justify-center';

  return undefined;
}
</script>

<template>
  <thead>
    <tr v-for="(headerGroup, index) in headerGroups" :key="headerGroup.id">
      <!-- The expander and select headers render a full-bleed hit target that
           supplies its own padding, so the cell must not add any of its own. -->
      <th
        v-if="index === 0 && slots['header-expander']"
        class="border-secondary-400/20 w-10 border-b-2 p-0"
      >
        <slot name="header-expander" />
      </th>
      <th
        v-for="header in headerGroup.headers"
        :key="header.id"
        class="border-secondary-400/20 border-b-2 font-semibold"
        :class="[
          // Only default to text-left when the column has not asked for an
          // alignment itself — both classes on one element leaves the winner
          // to Tailwind's output order rather than to the caller.
          justifyFor(header.column.id) === undefined ? 'text-left' : '',
          columnClasses?.[header.column.id],
          header.column.id === 'select' ? 'p-0' : 'px-4 py-2',
          {
            'hover:bg-primary-500/20 cursor-pointer rounded select-none':
              header.column.getCanSort(),
          },
        ]"
        @click="header.column.getToggleSortingHandler()?.($event)"
      >
        <div
          class="flex items-center gap-2"
          :class="[
            justifyFor(header.column.id),
            { 'h-full w-full gap-0': header.column.id === 'select' },
          ]"
        >
          <slot :name="`header-${header.column.id}`" :header="header">
            <FlexRender :header="header" />
          </slot>
          <span v-if="header.column.getCanSort()" class="text-slate-400">
            <ChevronUp v-if="header.column.getIsSorted() === 'asc'" class="h-4 w-4" />
            <ChevronDown v-else-if="header.column.getIsSorted() === 'desc'" class="h-4 w-4" />
            <ChevronsUpDown v-else class="h-4 w-4" />
          </span>
        </div>
      </th>
    </tr>
  </thead>
</template>
