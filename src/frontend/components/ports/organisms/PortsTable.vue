<script setup lang="ts">
import {
  type ColumnDef,
  createColumnHelper,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useVueTable,
} from '@tanstack/vue-table';
import { Folder, Globe, Loader2, X } from 'lucide-vue-next';
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import type { PortEntry, ProjectWithDetails } from '@/shared/types/api';
import { RouteNames } from '@/router';
import { useFormatters } from '@/composables/useFormatters';
import { statusColorClass } from '@/constants/portStatusColor';
import ProjectIcon from '../../projects/atoms/ProjectIcon.vue';
import TableHeader from '../../molecules/TableHeader.vue';
import { Button } from '../../ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/tooltip';
import PortCard from '../molecules/PortCard.vue';
import ProcessName from '../atoms/ProcessName.vue';

const { formatRelativeDate } = useFormatters();

const props = defineProps<{
  ports: PortEntry[];
  viewMode?: 'table' | 'card';
  sorting?: SortingState;
  projectByPath?: Map<string, ProjectWithDetails>;
  httpPorts?: Map<number, { isHttp: boolean; url: string; statusCode: number | null }>;
  screenshots?: Map<number, string>;
  isProbing?: boolean;
  killingPids?: Set<number>;
  dyingPids?: Set<number>;
}>();

const emit = defineEmits<{
  kill: [pid: number];
  'update:sorting': [sorting: SortingState];
}>();

const currentSorting = computed(() => props.sorting ?? []);

const openUrl = (url: string) => {
  window.electron?.shell.openExternal(url);
};

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
  columnHelper.accessor('cwd', {
    header: 'Directory',
    enableSorting: false,
    cell: p => p.row.original.cwd,
  }),
  columnHelper.accessor('startedAt', {
    header: 'Uptime',
    enableSorting: true,
    cell: p => p.row.original.startedAt,
  }),
  columnHelper.display({
    id: 'web',
    header: '',
    enableSorting: false,
    cell: p => p.row.original,
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
      return currentSorting.value;
    },
  },
  onSortingChange: updaterOrValue => {
    const newValue =
      typeof updaterOrValue === 'function' ? updaterOrValue(currentSorting.value) : updaterOrValue;
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
      <div
        v-for="row in table.getRowModel().rows"
        :key="`${row.original.pid}-${row.original.port}-card`"
        :class="{ 'port-dying': props.dyingPids?.has(row.original.pid) }"
      >
        <PortCard
          :port="row.original"
          :project-by-path="props.projectByPath ?? new Map()"
          :http-info="props.httpPorts?.get(row.original.port)"
          :screenshot="props.screenshots?.get(row.original.port)"
          :is-killing="props.killingPids?.has(row.original.pid) ?? false"
          @kill="emit('kill', $event)"
        />
      </div>
    </div>

    <!-- Table View -->
    <div v-else class="overflow-x-auto rounded-lg">
      <table class="w-full border-collapse">
        <TableHeader :header-groups="table.getHeaderGroups()" />
        <tbody>
          <template
            v-for="row in table.getRowModel().rows"
            :key="`${row.original.pid}-${row.original.port}`"
          >
            <tr
              class="port-row border-b border-slate-100 transition-colors"
              :class="{ 'port-dying': props.dyingPids?.has(row.original.pid) }"
            >
              <td v-for="cell in row.getVisibleCells()" :key="cell.id" class="px-4 py-3 text-sm">
                <template v-if="cell.column.id === 'port'">
                  <span class="font-mono font-bold text-slate-900">:{{ row.original.port }}</span>
                </template>

                <template v-else-if="cell.column.id === 'processName'">
                  <ProcessName
                    :process-name="row.original.processName"
                    :script-name="row.original.scriptName"
                  />
                </template>

                <template v-else-if="cell.column.id === 'pid'">
                  <span class="font-mono text-slate-500">{{ row.original.pid }}</span>
                </template>

                <template v-else-if="cell.column.id === 'startedAt'">
                  <span v-if="row.original.startedAt" class="text-slate-500">{{
                    formatRelativeDate(new Date(row.original.startedAt))
                  }}</span>
                  <span v-else class="text-xs text-slate-300">—</span>
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

                <template v-else-if="cell.column.id === 'web'">
                  <TooltipProvider v-if="props.httpPorts?.get(row.original.port)?.isHttp">
                    <Tooltip>
                      <TooltipTrigger as-child>
                        <button
                          class="flex flex-col items-center gap-0.5 rounded p-1 hover:bg-slate-100"
                          title="Open in browser"
                          @click.stop="openUrl(props.httpPorts!.get(row.original.port)!.url)"
                        >
                          <Globe
                            class="h-4 w-4"
                            :class="
                              statusColorClass(props.httpPorts!.get(row.original.port)!.statusCode)
                            "
                          />
                          <span
                            v-if="(props.httpPorts!.get(row.original.port)!.statusCode ?? 0) >= 300"
                            class="font-mono text-[10px] leading-none"
                            :class="
                              statusColorClass(props.httpPorts!.get(row.original.port)!.statusCode)
                            "
                          >
                            {{ props.httpPorts!.get(row.original.port)!.statusCode }}
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="left" class="p-1">
                        <template v-if="props.screenshots?.get(row.original.port)">
                          <img
                            :src="props.screenshots.get(row.original.port)"
                            class="h-32 w-48 rounded-md object-cover object-top"
                            alt="Page preview"
                          />
                        </template>
                        <template v-else>
                          <span class="pr-1 text-xs">{{
                            props.httpPorts!.get(row.original.port)!.url
                          }}</span>
                        </template>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <span
                    v-else-if="props.isProbing"
                    class="inline-block h-2 w-2 animate-pulse rounded-full bg-slate-200"
                  />
                </template>

                <template v-else-if="cell.column.id === 'actions'">
                  <Button
                    variant="ghost"
                    size="icon"
                    class="h-7 w-7"
                    :class="
                      props.killingPids?.has(row.original.pid)
                        ? 'cursor-default'
                        : 'text-slate-400 hover:text-red-500'
                    "
                    :disabled="props.killingPids?.has(row.original.pid)"
                    title="Kill process"
                    @click="emit('kill', row.original.pid)"
                  >
                    <Loader2
                      v-if="props.killingPids?.has(row.original.pid)"
                      class="h-4 w-4 animate-spin"
                    />
                    <X v-else class="h-4 w-4" />
                  </Button>
                </template>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.port-row:hover {
  background-color: var(--color-slate-50, #f8fafc);
}

.port-dying {
  animation: port-fade-out 0.45s ease-out forwards;
  pointer-events: none;
}

@keyframes port-fade-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
</style>
