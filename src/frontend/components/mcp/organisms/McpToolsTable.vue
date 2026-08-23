<script setup lang="ts">
import { computed } from 'vue';
import { type ColumnDef, createColumnHelper, type SortingState } from '@tanstack/vue-table';
import { AlertTriangle } from 'lucide-vue-next';
import DataTable from '../../tables/DataTable.vue';
import { type DataTableFeatures } from '../../tables/features';
import { Badge } from '../../ui/badge';
import McpToolCard from '../molecules/McpToolCard.vue';
import type { McpToolInfo } from '../../../../shared/constants/mcp-tools';
import type { EventCount } from '../../../../shared/types/api';
import { useFormatters } from '@/composables/useFormatters';

/** A catalog entry joined with its usage aggregates. */
export interface McpToolRow extends McpToolInfo {
  total: number;
  errors: number;
  avgDurationMs: number | null;
  lastUsedAt: Date | null;
}

const props = defineProps<{
  tools: McpToolInfo[];
  counts: EventCount[];
  viewMode?: 'table' | 'card';
  sorting?: SortingState;
}>();

const emit = defineEmits<{
  'update:sorting': [sorting: SortingState];
}>();

const { formatRelativeDate } = useFormatters();

const countsByName = computed(() => new Map(props.counts.map(count => [count.name, count])));

const rows = computed<McpToolRow[]>(() =>
  props.tools.map(tool => {
    const usage = countsByName.value.get(tool.name);
    return {
      ...tool,
      total: usage?.total ?? 0,
      errors: usage?.errors ?? 0,
      avgDurationMs: usage?.avgDurationMs ?? null,
      lastUsedAt: usage?.lastUsedAt ? new Date(usage.lastUsedAt) : null,
    };
  })
);

const columnHelper = createColumnHelper<DataTableFeatures, McpToolRow>();

const columns: ColumnDef<DataTableFeatures, McpToolRow, any>[] = [
  columnHelper.accessor('name', { header: 'Tool', enableSorting: true }),
  columnHelper.accessor('total', { header: 'Calls', enableSorting: true }),
  columnHelper.accessor('errors', { header: 'Errors', enableSorting: true }),
  columnHelper.accessor('avgDurationMs', { header: 'Avg', enableSorting: true }),
  columnHelper.accessor('lastUsedAt', { header: 'Last used', enableSorting: true }),
];

const getRowId = (tool: McpToolRow) => tool.name;

const usageFor = (name: string) => countsByName.value.get(name);
</script>

<template>
  <DataTable
    :data="rows"
    :columns="columns"
    :view-mode="viewMode"
    :sorting="sorting"
    :get-row-id="getRowId"
    enable-expansion
    @update:sorting="emit('update:sorting', $event)"
  >
    <template #cell-name="{ row }">
      <div class="flex items-center gap-2">
        <code class="font-mono font-semibold text-slate-900">{{ row.name }}</code>
        <Badge
          v-if="row.destructive"
          variant="outline"
          class="text-danger-500 border-danger-500"
          title="Irreversible — only run when asked"
        >
          <AlertTriangle class="h-3 w-3" />
        </Badge>
      </div>
    </template>

    <template #cell-total="{ row }">
      <span v-if="row.total > 0" class="font-medium text-slate-900">{{ row.total }}</span>
      <span v-else class="text-slate-400">—</span>
    </template>

    <template #cell-errors="{ row }">
      <span v-if="row.errors > 0" class="text-danger-500 font-medium">{{ row.errors }}</span>
      <span v-else class="text-slate-400">—</span>
    </template>

    <template #cell-avgDurationMs="{ row }">
      <span v-if="row.avgDurationMs !== null" class="text-slate-600">
        {{ row.avgDurationMs }}ms
      </span>
      <span v-else class="text-slate-400">—</span>
    </template>

    <template #cell-lastUsedAt="{ row }">
      <span v-if="row.lastUsedAt" class="text-slate-600">
        {{ formatRelativeDate(row.lastUsedAt) }}
      </span>
      <span v-else class="text-slate-400">Never used</span>
    </template>

    <!-- DataTable already supplies the card grid; don't nest another one here. -->
    <template #card="{ items }">
      <McpToolCard
        v-for="tool in items"
        :key="tool.name"
        :tool="tool"
        :usage="usageFor(tool.name)"
      />
    </template>

    <template #expanded-row="{ row }">
      <div class="space-y-3 px-4 py-3">
        <p class="max-w-4xl text-sm text-slate-600">{{ row.description }}</p>

        <div v-if="row.inputs.length > 0">
          <div class="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Parameters
          </div>
          <div class="space-y-1">
            <div
              v-for="input in row.inputs"
              :key="input.name"
              class="flex flex-wrap items-baseline gap-x-2 text-sm"
            >
              <code class="font-mono text-slate-800">{{ input.name }}</code>
              <span class="text-xs text-slate-400">{{ input.type }}</span>
              <span v-if="!input.required" class="text-xs text-slate-400">optional</span>
              <span class="text-slate-600">— {{ input.description }}</span>
            </div>
          </div>
        </div>
        <div v-else class="text-sm text-slate-500">Takes no parameters</div>
      </div>
    </template>

    <template #empty>No tools match your filters.</template>
  </DataTable>
</template>
