<script setup lang="ts">
import { computed } from 'vue';
import { type ColumnDef, createColumnHelper, type SortingState } from '@tanstack/vue-table';
import DataTable from '../../tables/DataTable.vue';
import { type DataTableFeatures } from '../../tables/features';
import McpStatusBadge from '../atoms/McpStatusBadge.vue';
import type { EventRecord } from '../../../../shared/types/api';
import { useFormatters } from '@/composables/useFormatters';

const props = defineProps<{
  events: EventRecord[];
  isLoading?: boolean;
  sorting?: SortingState;
}>();

const emit = defineEmits<{
  'update:sorting': [sorting: SortingState];
}>();

const { formatRelativeDate } = useFormatters();

/** Rows carry a Date for `occurredAt` so sorting compares timestamps, not strings. */
const rows = computed(() =>
  props.events.map(event => ({ ...event, occurredAt: new Date(event.occurredAt) }))
);

type EventRow = (typeof rows.value)[number];

const columnHelper = createColumnHelper<DataTableFeatures, EventRow>();

const columns: ColumnDef<DataTableFeatures, EventRow, any>[] = [
  columnHelper.accessor('occurredAt', { header: 'When', enableSorting: true }),
  columnHelper.accessor('name', { header: 'Tool', enableSorting: true }),
  columnHelper.accessor('status', { header: 'Status', enableSorting: true }),
  columnHelper.accessor('durationMs', { header: 'Duration', enableSorting: true }),
  columnHelper.accessor('clientName', { header: 'Client', enableSorting: true }),
];

const getRowId = (event: EventRow) => event.id;

/** Args live in metadata as a JSON blob; show them formatted in the drill-down. */
function argsFor(event: EventRow): string | null {
  const args = (event.metadata as { args?: unknown } | null)?.args;
  if (args === undefined || args === null) return null;
  return JSON.stringify(args, null, 2);
}
</script>

<template>
  <DataTable
    :data="rows"
    :columns="columns"
    :is-loading="isLoading"
    :sorting="sorting"
    :get-row-id="getRowId"
    enable-expansion
    @update:sorting="emit('update:sorting', $event)"
  >
    <template #cell-occurredAt="{ row }">
      <span class="whitespace-nowrap text-slate-600" :title="row.occurredAt.toLocaleString()">
        {{ formatRelativeDate(row.occurredAt) }}
      </span>
    </template>

    <template #cell-name="{ row }">
      <code class="font-mono text-slate-900">{{ row.name }}</code>
    </template>

    <template #cell-status="{ row }">
      <McpStatusBadge :status="row.status" />
    </template>

    <template #cell-durationMs="{ row }">
      <span v-if="row.durationMs !== null && row.durationMs !== undefined" class="text-slate-600">
        {{ row.durationMs }}ms
      </span>
      <span v-else class="text-slate-400">—</span>
    </template>

    <template #cell-clientName="{ row }">
      <span v-if="row.clientName" class="text-slate-600">{{ row.clientName }}</span>
      <span v-else class="text-slate-400">Unknown</span>
    </template>

    <template #expanded-row="{ row }">
      <div class="space-y-3 px-4 py-3">
        <div v-if="row.errorMessage">
          <div class="mb-1 text-xs font-semibold text-slate-500 uppercase">Error</div>
          <div class="text-danger-500 text-sm">{{ row.errorMessage }}</div>
        </div>

        <div>
          <div class="mb-1 text-xs font-semibold text-slate-500 uppercase">Arguments</div>
          <pre
            v-if="argsFor(row)"
            class="bg-muted overflow-x-auto rounded-md p-3 text-xs"
          ><code>{{ argsFor(row) }}</code></pre>
          <div v-else class="text-sm text-slate-500">No arguments</div>
        </div>

        <p class="text-xs text-slate-400">
          Results are never recorded — only the arguments shown above.
        </p>
      </div>
    </template>

    <template #empty>
      No tool calls yet. Connect a client above, then ask it to list your projects.
    </template>
  </DataTable>
</template>
