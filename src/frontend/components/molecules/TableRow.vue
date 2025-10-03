<script setup lang="ts" generic="TData">
import type { Row } from '@tanstack/vue-table';
import { FlexRender } from '@tanstack/vue-table';

defineProps<{
  row: Row<TData>;
}>();
</script>

<template>
  <tr class="hover:bg-gray-50">
    <td v-for="cell in row.getVisibleCells()" :key="cell.id" class="border-b px-4 py-2">
      <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
    </td>
  </tr>
</template>
