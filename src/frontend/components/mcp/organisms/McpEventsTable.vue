<script setup lang="ts">
import { computed } from 'vue';
import { type ColumnDef, createColumnHelper, type SortingState } from '@tanstack/vue-table';
import DataTable from '../../tables/DataTable.vue';
import { type DataTableFeatures } from '../../tables/features';
import McpStatusBadge from '../atoms/McpStatusBadge.vue';
import ProjectLink from '../../projects/atoms/ProjectLink.vue';
import type { EventRecord, ProjectWithDetails } from '../../../../shared/types/api';
import { terminalDisplayName } from '../../../../shared/constants/terminals';
import { useFormatters } from '@/composables/useFormatters';

const props = defineProps<{
  events: EventRecord[];
  /** Resolves recorded project ids to something linkable; see Mcp.vue. */
  projectsById?: Map<string, ProjectWithDetails>;
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
  // Sorts by resolved name so unattributed calls group together, rather than by
  // the raw path, which would interleave them by directory.
  columnHelper.accessor(row => row.project?.name ?? '', {
    id: 'project',
    header: 'Project',
    enableSorting: true,
  }),
  columnHelper.accessor('status', { header: 'Status', enableSorting: true }),
  columnHelper.accessor('durationMs', { header: 'Duration', enableSorting: true }),
  columnHelper.accessor('clientName', { header: 'Client', enableSorting: true }),
];

const getRowId = (event: EventRow) => event.id;

/**
 * Last path segment of the working directory.
 *
 * Used where a full path would not fit. The complete path stays available in
 * the drill-down and in the `title` attribute.
 */
function directoryLabel(event: EventRow): string | null {
  if (!event.workingDir) return null;
  const segments = event.workingDir.split(/[/\\]/).filter(Boolean);
  return segments[segments.length - 1] ?? event.workingDir;
}

/**
 * Args live in metadata as a JSON blob.
 *
 * Rendered as one line per key rather than a single `JSON.stringify` dump so a
 * project id can be annotated with the project it refers to. The raw value is
 * always kept: when a call fails, the literal id the agent sent is the thing
 * worth seeing.
 */
interface ArgEntry {
  key: string;
  value: string;
  /** Set only for a project id that resolved; drives the inline link. */
  project: ProjectWithDetails | null;
}

/**
 * Match on the key name, not the value's shape. These ids are cuid2, not UUIDs,
 * so there is no reliable pattern to detect them by.
 */
const PROJECT_ID_KEY = 'projectId';

function argEntriesFor(event: EventRow): ArgEntry[] | null {
  const args = (event.metadata as { args?: unknown } | null)?.args;
  if (typeof args !== 'object' || args === null || Array.isArray(args)) return null;

  const entries = Object.entries(args as Record<string, unknown>);
  if (entries.length === 0) return null;

  return entries.map(([key, value]) => ({
    key,
    // Nested objects still get JSON, just scoped to the one value.
    value: typeof value === 'string' ? value : JSON.stringify(value),
    project:
      key === PROJECT_ID_KEY && typeof value === 'string'
        ? (props.projectsById?.get(value) ?? null)
        : null,
  }));
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

    <template #cell-project="{ row }">
      <!-- Falls back to the bare directory name: the call still came from
           somewhere real, even when that path is not a tracked project. -->
      <ProjectLink
        :project="row.project"
        :fallback="directoryLabel(row)"
        :fallback-title="row.workingDir"
      />
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
        <!-- Where the call came from. Captured once per MCP server process, so
             every call in one agent session shares these values. -->
        <div v-if="row.workingDir || row.terminal || row.project">
          <div class="mb-1 text-xs font-semibold text-slate-500 uppercase">Origin</div>
          <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <template v-if="row.project">
              <dt class="text-slate-500">Project</dt>
              <dd><ProjectLink :project="row.project" /></dd>
            </template>

            <template v-if="row.workingDir">
              <dt class="text-slate-500">Directory</dt>
              <dd class="min-w-0">
                <!-- Truncates from the left so the meaningful tail stays
                     visible, matching ProjectCard. -->
                <div
                  dir="rtl"
                  class="truncate text-left font-mono text-xs text-slate-700"
                  :title="row.workingDir"
                >
                  {{ row.workingDir }}
                </div>
              </dd>
            </template>

            <template v-if="row.terminal">
              <dt class="text-slate-500">Terminal</dt>
              <dd class="text-slate-700">{{ terminalDisplayName(row.terminal) }}</dd>
            </template>
          </dl>
        </div>

        <div v-if="row.errorMessage">
          <div class="mb-1 text-xs font-semibold text-slate-500 uppercase">Error</div>
          <div class="text-danger-500 text-sm">{{ row.errorMessage }}</div>
        </div>

        <div>
          <div class="mb-1 text-xs font-semibold text-slate-500 uppercase">Arguments</div>
          <div v-if="argEntriesFor(row)" class="bg-muted overflow-x-auto rounded-md p-3">
            <div
              v-for="entry in argEntriesFor(row)"
              :key="entry.key"
              class="flex flex-wrap items-center gap-x-2 font-mono text-xs leading-6"
            >
              <span class="text-slate-500">{{ entry.key }}:</span>
              <span class="text-slate-900">{{ entry.value }}</span>
              <!-- Resolved project sits beside the raw id, never replacing it. -->
              <template v-if="entry.project">
                <span class="text-slate-400">→</span>
                <ProjectLink :project="entry.project" :show-icon="false" />
              </template>
            </div>
          </div>
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
