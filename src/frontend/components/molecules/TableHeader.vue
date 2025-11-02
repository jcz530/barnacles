<script setup lang="ts" generic="TData">
import type { HeaderGroup } from '@tanstack/vue-table';
import { FlexRender } from '@tanstack/vue-table';
import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-vue-next';

defineProps<{
  headerGroups: HeaderGroup<TData>[];
}>();
</script>

<template>
  <thead>
    <tr v-for="headerGroup in headerGroups" :key="headerGroup.id">
      <th
        v-for="header in headerGroup.headers"
        :key="header.id"
        class="border-secondary-400/20 border-b-2 px-4 py-2 text-left font-semibold"
        :class="{
          'hover:bg-primary-500/20 cursor-pointer rounded select-none': header.column.getCanSort(),
        }"
        @click="header.column.getToggleSortingHandler()?.($event)"
      >
        <div class="flex items-center gap-2">
          <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
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
