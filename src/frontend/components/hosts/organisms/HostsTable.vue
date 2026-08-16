<script setup lang="ts">
import {
  type ColumnDef,
  createColumnHelper,
  type SortingState,
  useTable,
} from '@tanstack/vue-table';
import { ref } from 'vue';
import { type DataTableFeatures, features } from '../../tables/features';
import TableHeader from '../../tables/TableHeader.vue';
import HostsTableRow from '../molecules/HostsTableRow.vue';

interface HostEntry {
  id: string;
  ip: string;
  hostname: string;
}

interface Props {
  hosts: HostEntry[];
  searchQuery?: string;
  sorting?: SortingState;
  modifiedFields?: Record<string, { ip: boolean; hostname: boolean }>;
}

const props = withDefaults(defineProps<Props>(), {
  searchQuery: '',
  sorting: () => [{ id: 'hostname', desc: false }],
  modifiedFields: () => ({}),
});

const emit = defineEmits<{
  'update:sorting': [value: SortingState];
  'update:searchQuery': [value: string];
  'update:host': [id: string, field: 'ip' | 'hostname', value: string];
  'remove:host': [id: string];
}>();

// Rows are fully custom editable inputs rendered by HostsTableRow, so this
// table drives its own markup rather than DataTable's cell slots; TanStack
// supplies the header, sorting and filtering only.
const columnHelper = createColumnHelper<DataTableFeatures, HostEntry>();

const columns: ColumnDef<DataTableFeatures, HostEntry, any>[] = [
  columnHelper.accessor('ip', { header: 'IP Address', enableSorting: true }),
  columnHelper.accessor('hostname', { header: 'Hostname', enableSorting: true }),
  columnHelper.accessor('id', { header: 'Actions', enableSorting: false }),
];

const localSorting = ref<SortingState>(props.sorting);

const table = useTable({
  features,
  get data() {
    return props.hosts;
  },
  columns,
  state: {
    get sorting() {
      return localSorting.value;
    },
    get globalFilter() {
      return props.searchQuery;
    },
  },
  onSortingChange: updaterOrValue => {
    const newValue =
      typeof updaterOrValue === 'function' ? updaterOrValue(localSorting.value) : updaterOrValue;
    localSorting.value = newValue;
    emit('update:sorting', newValue);
  },
  onGlobalFilterChange: value => {
    emit('update:searchQuery', String(value ?? ''));
  },
  globalFilterFn: (row, _columnId, filterValue) => {
    const host = row.original;
    const search = String(filterValue).toLowerCase();
    return host.ip.toLowerCase().includes(search) || host.hostname.toLowerCase().includes(search);
  },
});
</script>

<template>
  <div v-if="hosts.length > 0" class="overflow-hidden rounded-lg border">
    <table class="w-full border-collapse">
      <TableHeader :header-groups="table.getHeaderGroups()" />
      <tbody>
        <HostsTableRow
          v-for="row in table.getRowModel().rows"
          :key="row.id"
          :host="row.original"
          :is-ip-modified="modifiedFields[row.original.id]?.ip ?? false"
          :is-hostname-modified="modifiedFields[row.original.id]?.hostname ?? false"
          @update:ip="val => emit('update:host', row.original.id, 'ip', val)"
          @update:hostname="val => emit('update:host', row.original.id, 'hostname', val)"
          @remove="emit('remove:host', row.original.id)"
        />
      </tbody>
    </table>
  </div>

  <!-- Empty State -->
  <div v-else class="text-muted-foreground rounded-lg border border-dashed px-4 py-12 text-center">
    <p class="text-base font-medium">No host entries found</p>
    <p class="mt-1 text-sm">Add a new entry to get started mapping custom domains</p>
  </div>
</template>
