<script setup lang="ts">
import {
  type ColumnDef,
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useVueTable,
} from '@tanstack/vue-table';
import { Folder, X } from 'lucide-vue-next';
import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import type { PortEntry, ProjectWithDetails } from '../../../../../shared/types/api';
import { RouteNames } from '@/router';
import ProjectIcon from '../../projects/atoms/ProjectIcon.vue';
import TableHeader from '../../molecules/TableHeader.vue';
import { Button } from '../../ui/button';
import PortCard from '../molecules/PortCard.vue';
import ProcessName from '../atoms/ProcessName.vue';

const props = defineProps<{
  ports: PortEntry[];
  viewMode?: 'table' | 'card';
  sorting?: SortingState;
  projectByPath?: Map<string, ProjectWithDetails>;
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
  columnHelper.accessor('cwd', {
    header: 'Directory',
    enableSorting: false,
    cell: p => p.row.original.cwd,
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
        :project-by-path="props.projectByPath ?? new Map()"
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
                <ProcessName :process-name="row.original.processName" />
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

              <template v-else-if="cell.column.id === 'cwd'">
                <template v-if="row.original.cwd && props.projectByPath?.get(row.original.cwd)">
                  <RouterLink
                    :to="{
                      name: RouteNames.ProjectOverview,
                      params: { id: props.projectByPath!.get(row.original.cwd)!.id },
                    }"
                    class="flex items-center gap-2 text-slate-700 hover:underline"
                    @click.stop
                  >
                    <ProjectIcon
                      :project-id="props.projectByPath!.get(row.original.cwd)!.id"
                      :project-name="props.projectByPath!.get(row.original.cwd)!.name"
                      :has-icon="!!props.projectByPath!.get(row.original.cwd)!.icon"
                      size="sm"
                    />
                    <span class="text-sm font-medium">{{
                      props.projectByPath!.get(row.original.cwd)!.name
                    }}</span>
                  </RouterLink>
                </template>
                <div
                  v-else-if="row.original.cwd"
                  class="flex items-center gap-1.5 text-slate-500"
                  :title="row.original.cwd"
                >
                  <Folder class="h-3.5 w-3.5 shrink-0" />
                  <span class="max-w-64 truncate font-mono text-xs" dir="rtl">{{
                    row.original.cwd
                  }}</span>
                </div>
                <span v-else class="text-xs text-slate-300">—</span>
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
