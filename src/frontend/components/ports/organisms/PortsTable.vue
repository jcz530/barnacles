<script setup lang="ts">
import { type ColumnDef, createColumnHelper, type SortingState } from '@tanstack/vue-table';
import { Folder, Globe, Loader2, X } from 'lucide-vue-next';
import { RouterLink } from 'vue-router';
import type { PortEntry, ProjectWithDetails } from '@/shared/types/api';
import { RouteNames } from '@/router';
import { useFormatters } from '@/composables/useFormatters';
import { statusColorClass } from '@/constants/portStatusColor';
import ProjectIcon from '../../projects/atoms/ProjectIcon.vue';
import DataTable from '../../tables/DataTable.vue';
import { type DataTableFeatures } from '../../tables/features';
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

const openUrl = (url: string) => {
  window.electron?.shell.openExternal(url);
};

const columnHelper = createColumnHelper<DataTableFeatures, PortEntry>();

const columns: ColumnDef<DataTableFeatures, PortEntry, any>[] = [
  columnHelper.accessor('port', { header: 'Port', enableSorting: true }),
  columnHelper.accessor('processName', { header: 'Process', enableSorting: true }),
  columnHelper.accessor('pid', { header: 'PID', enableSorting: true }),
  columnHelper.accessor('cwd', { header: 'Directory', enableSorting: false }),
  columnHelper.accessor('startedAt', { header: 'Uptime', enableSorting: true }),
  columnHelper.display({ id: 'web', header: '', enableSorting: false }),
  columnHelper.display({ id: 'actions', header: '', enableSorting: false }),
];

// A process being killed fades out before it disappears from the list.
const rowClass = (port: PortEntry) => ({ 'port-dying': props.dyingPids?.has(port.pid) ?? false });

// Ports are unique per pid+port pair; pid alone repeats when one process
// listens on several ports.
const getRowId = (port: PortEntry) => `${port.pid}-${port.port}`;

const httpInfoFor = (port: PortEntry) => props.httpPorts?.get(port.port);
const projectFor = (port: PortEntry) => (port.cwd ? props.projectByPath?.get(port.cwd) : undefined);
</script>

<template>
  <DataTable
    :data="ports"
    :columns="columns"
    :view-mode="viewMode"
    :sorting="sorting"
    :get-row-id="getRowId"
    :row-class="rowClass"
    @update:sorting="emit('update:sorting', $event)"
  >
    <template #cell-port="{ row }">
      <span class="font-mono font-bold text-slate-900">:{{ row.port }}</span>
    </template>

    <template #cell-processName="{ row }">
      <ProcessName :process-name="row.processName" :script-name="row.scriptName" />
    </template>

    <template #cell-pid="{ row }">
      <span class="font-mono text-slate-500">{{ row.pid }}</span>
    </template>

    <template #cell-cwd="{ row }">
      <RouterLink
        v-if="projectFor(row)"
        :to="{ name: RouteNames.ProjectOverview, params: { id: projectFor(row)!.id } }"
        class="flex items-center gap-2 text-slate-700 hover:underline"
        @click.stop
      >
        <ProjectIcon
          :project-id="projectFor(row)!.id"
          :project-name="projectFor(row)!.name"
          :has-icon="!!projectFor(row)!.icon"
          size="sm"
        />
        <span class="text-sm font-medium">{{ projectFor(row)!.name }}</span>
      </RouterLink>
      <div v-else-if="row.cwd" class="flex items-center gap-1.5 text-slate-500" :title="row.cwd">
        <Folder class="h-3.5 w-3.5 shrink-0" />
        <span class="max-w-64 truncate font-mono text-xs" dir="rtl">{{ row.cwd }}</span>
      </div>
      <span v-else class="text-xs text-slate-300">—</span>
    </template>

    <template #cell-startedAt="{ row }">
      <span v-if="row.startedAt" class="text-slate-500">
        {{ formatRelativeDate(new Date(row.startedAt)) }}
      </span>
      <span v-else class="text-xs text-slate-300">—</span>
    </template>

    <template #cell-web="{ row }">
      <TooltipProvider v-if="httpInfoFor(row)?.isHttp">
        <Tooltip>
          <TooltipTrigger as-child>
            <button
              class="flex flex-col items-center gap-0.5 rounded p-1 hover:bg-slate-100"
              title="Open in browser"
              @click.stop="openUrl(httpInfoFor(row)!.url)"
            >
              <Globe class="h-4 w-4" :class="statusColorClass(httpInfoFor(row)!.statusCode)" />
              <span
                v-if="(httpInfoFor(row)!.statusCode ?? 0) >= 300"
                class="font-mono text-[10px] leading-none"
                :class="statusColorClass(httpInfoFor(row)!.statusCode)"
              >
                {{ httpInfoFor(row)!.statusCode }}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" class="p-1">
            <img
              v-if="screenshots?.get(row.port)"
              :src="screenshots.get(row.port)"
              class="h-32 w-48 rounded-md object-cover object-top"
              alt="Page preview"
            />
            <span v-else class="pr-1 text-xs">{{ httpInfoFor(row)!.url }}</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <span
        v-else-if="isProbing"
        class="inline-block h-2 w-2 animate-pulse rounded-full bg-slate-200"
      />
    </template>

    <template #cell-actions="{ row }">
      <Button
        variant="ghost"
        size="icon"
        class="h-7 w-7"
        :class="
          killingPids?.has(row.pid) ? 'cursor-default' : 'hover:text-danger-500 text-slate-400'
        "
        :disabled="killingPids?.has(row.pid)"
        title="Kill process"
        @click="emit('kill', row.pid)"
      >
        <Loader2 v-if="killingPids?.has(row.pid)" class="h-4 w-4 animate-spin" />
        <X v-else class="h-4 w-4" />
      </Button>
    </template>

    <template #card="{ items }">
      <div
        v-for="port in items"
        :key="`${getRowId(port)}-card`"
        :class="{ 'port-dying': dyingPids?.has(port.pid) }"
      >
        <PortCard
          :port="port"
          :project-by-path="projectByPath ?? new Map()"
          :http-info="httpPorts?.get(port.port)"
          :screenshot="screenshots?.get(port.port)"
          :is-killing="killingPids?.has(port.pid) ?? false"
          @kill="emit('kill', $event)"
        />
      </div>
    </template>
  </DataTable>
</template>

<style scoped>
/* :deep() because the row carrying this class is rendered by DataTable, so it
   carries DataTable's scope id rather than this component's — a plain scoped
   selector would compile to .port-dying[data-v-<ports>] and never match. The
   card wrapper below is in this template, hence the second, unscoped-depth
   selector covering both view modes. */
:deep(.port-dying),
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
