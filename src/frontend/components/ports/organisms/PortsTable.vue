<script setup lang="ts">
import {
  type ColumnDef,
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useVueTable,
} from '@tanstack/vue-table';
import { X } from 'lucide-vue-next';
import { ref } from 'vue';
import type { PortEntry } from '../../../../../shared/types/api';
import TableHeader from '../../molecules/TableHeader.vue';
import { Button } from '../../ui/button';
import PortCard from '../molecules/PortCard.vue';

const props = defineProps<{
  ports: PortEntry[];
  viewMode?: 'table' | 'card';
  sorting?: SortingState;
}>();

const emit = defineEmits<{
  kill: [pid: number];
  'update:sorting': [sorting: SortingState];
}>();

const internalSorting = ref<SortingState>(props.sorting || []);

const columnHelper = createColumnHelper<PortEntry>();

const columns: ColumnDef<PortEntry, any>[] = [
  columnHelper.accessor('port', {
    header: 'Port',
    enableSorting: true,
    cell: p => p.row.original.port,
  }),
  columnHelper.accessor('processName', {
    header: 'Process',
    enableSorting: true,
    cell: p => p.row.original.processName,
  }),
  columnHelper.accessor('pid', {
    header: 'PID',
    enableSorting: true,
    cell: p => p.row.original.pid,
  }),
  columnHelper.accessor('protocol', {
    header: 'Protocol',
    enableSorting: false,
    cell: p => p.row.original.protocol,
  }),
  columnHelper.display({
    id: 'actions',
    header: '',
    enableSorting: false,
    cell: p => p.row.original,
  }),
];

const table = useVueTable({
  get data() {
    return props.ports;
  },
  columns,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  state: {
    get sorting() {
      return internalSorting.value;
    },
  },
  onSortingChange: updaterOrValue => {
    const newValue =
      typeof updaterOrValue === 'function' ? updaterOrValue(internalSorting.value) : updaterOrValue;
    internalSorting.value = newValue;
    emit('update:sorting', newValue);
  },
});
</script>

<template>
  <div class="w-full">
    <!-- Card View -->
    <div
      v-if="viewMode === 'card'"
      class="grid grid-cols-1 gap-4 px-4 md:grid-cols-2 lg:grid-cols-3"
    >
      <PortCard
        v-for="port in ports"
        :key="`${port.pid}-${port.port}-card`"
        :port="port"
        @kill="emit('kill', $event)"
      />
    </div>

    <!-- Table View -->
    <div v-else class="overflow-x-auto rounded-lg">
      <table class="w-full border-collapse">
        <TableHeader :header-groups="table.getHeaderGroups()" />
        <tbody>
          <tr
            v-for="row in table.getRowModel().rows"
            :key="`${row.original.pid}-${row.original.port}`"
            class="port-row border-b border-slate-100 transition-colors"
          >
            <td v-for="cell in row.getVisibleCells()" :key="cell.id" class="px-4 py-3 text-sm">
              <template v-if="cell.column.id === 'port'">
                <span class="font-mono font-bold text-slate-900">:{{ row.original.port }}</span>
              </template>

              <template v-else-if="cell.column.id === 'processName'">
                <span class="text-slate-900">{{ row.original.processName }}</span>
              </template>

              <template v-else-if="cell.column.id === 'pid'">
                <span class="font-mono text-slate-500">{{ row.original.pid }}</span>
              </template>

              <template v-else-if="cell.column.id === 'protocol'">
                <span
                  class="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700"
                >
                  {{ row.original.protocol }}
                </span>
              </template>

              <template v-else-if="cell.column.id === 'actions'">
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-7 w-7 text-slate-400 hover:text-red-500"
                  title="Kill process"
                  @click="emit('kill', row.original.pid)"
                >
                  <X class="h-4 w-4" />
                </Button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.port-row:hover {
  background-color: var(--color-slate-50, #f8fafc);
}
</style>
