<script setup lang="ts" generic="TData">
import type { HeaderGroup } from '@tanstack/vue-table';
import { FlexRender } from '@tanstack/vue-table';

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
        class="border-b-2 px-4 py-2 text-left font-semibold"
      >
        <FlexRender :render="header.column.columnDef.header" :props="header.getContext()" />
      </th>
    </tr>
  </thead>
</template>
