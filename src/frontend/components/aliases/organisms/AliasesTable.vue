<script setup lang="ts">
import type { Alias } from '@/shared/types/api';
import {
  type ColumnDef,
  createColumnHelper,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useVueTable,
} from '@tanstack/vue-table';
import { ref } from 'vue';
import TableHeader from '../../molecules/TableHeader.vue';
import AliasesTableRow from '../molecules/AliasesTableRow.vue';

interface Props {
  aliases: Alias[];
  newAliases: Alias[];
  searchQuery?: string;
  sorting?: SortingState;
  modifiedFields?: Record<
    string,
    { name: boolean; command: boolean; description: boolean; showCommand: boolean }
  >;
}

const props = withDefaults(defineProps<Props>(), {
  searchQuery: '',
  sorting: () => [{ id: 'name', desc: false }],
  modifiedFields: () => ({}),
});

const emit = defineEmits<{
  'update:sorting': [value: SortingState];
  'update:searchQuery': [value: string];
  'update:alias': [id: string, field: keyof Alias, value: unknown];
  'update:newAlias': [id: string, field: keyof Alias, value: unknown];
  'remove:alias': [id: string];
  'remove:newAlias': [id: string];
}>();

// TanStack Table setup
const columnHelper = createColumnHelper<Alias>();

const columns: ColumnDef<Alias, unknown>[] = [
  columnHelper.accessor('visible', {
    header: '',
    enableSorting: false,
    cell: props => props.row.original,
  }),
  columnHelper.accessor('name', {
    header: 'Alias Name',
    enableSorting: true,
    cell: props => props.row.original,
  }),
  columnHelper.accessor('command', {
    header: 'Command',
    enableSorting: false,
    cell: props => props.row.original,
  }),
  columnHelper.accessor('category', {
    header: 'Category',
    enableSorting: true,
    cell: props => props.row.original,
  }),
  columnHelper.accessor('id', {
    header: '',
    enableSorting: false,
    cell: props => props.row.original,
  }),
];

const localSorting = ref<SortingState>(props.sorting);

const table = useVueTable({
  get data() {
    return props.aliases;
  },
  columns,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
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
    emit('update:searchQuery', value);
  },
  globalFilterFn: (row, columnId, filterValue) => {
    const alias = row.original;
    const search = filterValue.toLowerCase();
    return (
      alias.name.toLowerCase().includes(search) ||
      alias.command.toLowerCase().includes(search) ||
      alias.category.toLowerCase().includes(search) ||
      (alias.description && alias.description.toLowerCase().includes(search))
    );
  },
});
</script>

<template>
  <div>
    <!-- Existing Aliases Table -->
    <div v-if="aliases.length > 0" class="mb-4 overflow-hidden rounded-lg border">
      <table class="w-full border-collapse">
        <TableHeader :header-groups="table.getHeaderGroups()" />
        <tbody>
          <AliasesTableRow
            v-for="row in table.getRowModel().rows"
            :key="row.id"
            :alias="row.original"
            :is-name-modified="modifiedFields[row.original.id]?.name ?? false"
            :is-command-modified="modifiedFields[row.original.id]?.command ?? false"
            :is-description-modified="modifiedFields[row.original.id]?.description ?? false"
            :is-show-command-modified="modifiedFields[row.original.id]?.showCommand ?? false"
            :is-new="false"
            @update:field="(field, val) => emit('update:alias', row.original.id, field, val)"
            @remove="emit('remove:alias', row.original.id)"
          />
        </tbody>
      </table>
    </div>

    <!-- New Aliases Section (Pending) -->
    <div v-if="newAliases.length > 0" class="space-y-2">
      <div class="flex items-center gap-2">
        <div class="bg-muted h-px flex-1"></div>
        <span class="text-muted-foreground text-xs font-medium tracking-wider uppercase">
          New Entries (Pending)
        </span>
        <div class="bg-muted h-px flex-1"></div>
      </div>

      <div class="rounded-lg border border-dashed border-yellow-300 bg-yellow-50/50">
        <table class="w-full border-collapse">
          <tbody>
            <AliasesTableRow
              v-for="alias in newAliases"
              :key="alias.id"
              :alias="alias"
              :is-new="true"
              @update:field="(field, val) => emit('update:newAlias', alias.id, field, val)"
              @remove="emit('remove:newAlias', alias.id)"
            />
          </tbody>
        </table>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-if="aliases.length === 0 && newAliases.length === 0"
      class="text-muted-foreground rounded-lg border border-dashed px-4 py-12 text-center"
    >
      <p class="text-base font-medium">No aliases found</p>
      <p class="mt-1 text-sm">Add a new entry or install a preset pack to get started</p>
    </div>
  </div>
</template>
