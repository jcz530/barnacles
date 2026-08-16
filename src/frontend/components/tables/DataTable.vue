<script setup lang="ts" generic="TData extends RowData">
import { type ColumnDef, type RowData, type SortingState, useTable } from '@tanstack/vue-table';
import { ChevronDown, ChevronRight } from 'lucide-vue-next';
import { computed, onMounted, ref, useAttrs, watch } from 'vue';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useBulkSelection, type SelectionState } from '@/composables/useBulkSelection';
import BulkActionsBar from './BulkActionsBar.vue';
import BulkConfirmDialog from './BulkConfirmDialog.vue';
import { useBulkActions } from './composables/useBulkActions';
import { type DataTableFeatures, features } from './features';
import TableHeader from './TableHeader.vue';
import type { BulkAction } from './types/bulk';

export interface DataTableProps<TData extends RowData> {
  /** Rows to display. Barnacles loads list data in full, so this is everything. */
  data: TData[];

  /**
   * TanStack Table column definitions.
   *
   * The cell-value type is `any` per column rather than `unknown` because a
   * table's columns are heterogeneous — `accessor('name')` yields
   * `TValue = string`, `accessor('count')` yields `number` — and `TValue` is
   * invariant in ColumnDef (it appears in output positions like `footer`), so
   * neither infers to a common supertype. Pinning it to `unknown` makes every
   * accessor column unassignable. Callers get their types from
   * `createColumnHelper<DataTableFeatures, Row>()`, which is where the real
   * checking happens; this prop only has to accept the resulting array.
   */

  columns: ColumnDef<DataTableFeatures, TData, any>[];

  /** Whether the table is in a loading state. */
  isLoading?: boolean;

  /** Display mode: table or card view. */
  viewMode?: 'table' | 'card';

  /** Current sorting state. */
  sorting?: SortingState;

  /** Global filter string, matched by each column's filter function. */
  globalFilter?: string;

  /** Function to get a stable unique ID from a row (for selection/expansion). */
  getRowId: (row: TData) => string;

  /**
   * Whether to enable row selection. Defaults to true if bulkActions are
   * provided, false otherwise.
   */
  enableSelection?: boolean;

  /** Optional column classes mapping (columnId -> CSS classes). */
  columnClasses?: Record<string, string>;

  /**
   * Per-row classes, for state a row carries that its cells do not — a pending
   * removal animation, a muted style for a disabled record. Receives the row
   * and returns anything Vue's `:class` accepts.
   */
  rowClass?: (row: TData) => string | string[] | Record<string, boolean> | undefined;

  /** Declarative bulk actions rendered as buttons in the bulk actions bar. */
  bulkActions?: BulkAction[];

  /** Called after a bulk action succeeds, to refresh the underlying data. */
  onBulkComplete?: () => void | Promise<void>;

  /**
   * DOM id of a mount point to teleport the bulk actions bar into, so the bar
   * overlays an existing results row instead of pushing the table down when it
   * appears. Falls back to rendering in-flow above the table if the target
   * isn't present.
   */
  bulkActionsTarget?: string;

  /**
   * Enables row expansion via the "expanded-row" slot: an expander column with
   * a chevron per row, plus a header expand-all/collapse-all toggle.
   */
  enableExpansion?: boolean;

  /**
   * Set of row IDs (from getRowId) whose "expanded-row" slot content should
   * render, as an extra full-width row directly beneath each. Pass to make
   * expansion controlled; omit v-model:expanded and DataTable manages it.
   */
  expanded?: Set<string>;

  /**
   * Initial expansion state, applied on mount. Ignored once `expanded` is
   * passed (controlled mode). Defaults to 'none'.
   */
  defaultExpanded?: 'all' | 'none' | string[];

  /**
   * 'toggle' (default) renders a chevron per row and in the header for
   * expand-all/collapse-all. 'always-open' renders every expanded-row slot
   * with no chevron and no way to collapse.
   */
  expansionMode?: 'toggle' | 'always-open';
}

const props = withDefaults(defineProps<DataTableProps<TData>>(), {
  isLoading: false,
  viewMode: 'table',
  enableSelection: undefined,
  enableExpansion: false,
  defaultExpanded: 'none',
  expansionMode: 'toggle',
});

const emit = defineEmits<{
  open: [row: TData];
  'update:sorting': [sorting: SortingState];
  'update:selection': [selection: SelectionState];
  'update:expanded': [expanded: Set<string>];
}>();

// Teleport targets must exist in the DOM before <Teleport> renders into them.
// A results row mounts alongside DataTable, so mount order isn't guaranteed —
// check once on mount rather than assuming the target is already there.
const bulkActionsTargetExists = ref(false);
onMounted(() => {
  if (props.bulkActionsTarget && document.getElementById(props.bulkActionsTarget)) {
    bulkActionsTargetExists.value = true;
  }
});

/* ---------------------------------------------------------------- expansion */

const expansionEnabled = computed(() => props.enableExpansion);

function initialExpandedSet(): Set<string> {
  if (Array.isArray(props.defaultExpanded)) return new Set(props.defaultExpanded);
  if (props.defaultExpanded === 'all') return new Set(props.data.map(props.getRowId));
  return new Set();
}

const internalExpanded = ref<Set<string>>(initialExpandedSet());

const expandedIds = computed(() => props.expanded ?? internalExpanded.value);

// Preserve whatever's expanded across data refreshes (dropping ids no longer
// present) rather than silently collapsing rows the user opened.
watch(
  () => props.data,
  () => {
    if (props.expanded !== undefined) return;
    const presentIds = new Set(props.data.map(props.getRowId));
    internalExpanded.value = new Set([...internalExpanded.value].filter(id => presentIds.has(id)));
  }
);

function setExpanded(next: Set<string>) {
  if (props.expanded === undefined) {
    internalExpanded.value = next;
  }
  emit('update:expanded', next);
}

function isRowExpanded(id: string): boolean {
  return props.expansionMode === 'always-open' || expandedIds.value.has(id);
}

function toggleRowExpanded(id: string) {
  if (props.expansionMode === 'always-open') return;
  const next = new Set(expandedIds.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  setExpanded(next);
}

function toggleAllVisibleExpanded(visibleRowIds: string[]) {
  if (props.expansionMode === 'always-open') return;
  const allOpen = visibleRowIds.every(id => expandedIds.value.has(id));
  const next = new Set(expandedIds.value);
  visibleRowIds.forEach(id => (allOpen ? next.delete(id) : next.add(id)));
  setExpanded(next);
}

/* ------------------------------------------------------------------ the table */

// Controlled when the caller passes `sorting` and keeps it updated from
// `update:sorting` (the prop is then the single source of truth); uncontrolled
// otherwise, seeding once from the prop. Reading the prop directly in the
// controlled case matters: TanStack hands `onSortingChange` an updater that is
// applied to the *current* state, so resolving it against a local copy that has
// drifted from the caller's value cycles the sort to the wrong step.
const internalSorting = ref<SortingState>(props.sorting ?? []);

const currentSorting = computed(() => props.sorting ?? internalSorting.value);

const hasSelectColumn = computed(() => props.columns.some(col => col.id === 'select'));

const enableSelection = computed(
  () => props.enableSelection ?? (props.bulkActions?.length ?? 0) > 0
);

// `any` for the cell-value type, for the reason given on the `columns` prop.

const tableColumns = computed<ColumnDef<DataTableFeatures, TData, any>[]>(() => {
  if (!enableSelection.value || hasSelectColumn.value) {
    return props.columns;
  }

  const selectColumn: ColumnDef<DataTableFeatures, TData, any> = {
    id: 'select',
    header: '',
    cell: () => null,
    enableSorting: false,
  };

  return [selectColumn, ...props.columns];
});

const columnClassesWithSelect = computed(() => {
  if (!enableSelection.value || hasSelectColumn.value) {
    return props.columnClasses;
  }
  return { select: 'w-8', ...props.columnClasses };
});

const table = useTable({
  features,
  get data() {
    return props.data;
  },
  get columns() {
    return tableColumns.value;
  },
  state: {
    get sorting() {
      return currentSorting.value;
    },
    get globalFilter() {
      return props.globalFilter ?? '';
    },
  },
  onSortingChange: updaterOrValue => {
    const newValue =
      typeof updaterOrValue === 'function' ? updaterOrValue(currentSorting.value) : updaterOrValue;
    internalSorting.value = newValue;
    emit('update:sorting', newValue);
  },
});

const tableRows = computed(() => table.getRowModel().rows);

/* ---------------------------------------------------------------- selection */

// Ids of every row currently in the table, after any active global filter —
// selecting "all" must not silently include rows the filter has hidden.
const visibleIds = computed(() => tableRows.value.map(row => props.getRowId(row.original)));

const visibleCount = computed(() => visibleIds.value.length);

const {
  selection,
  selectionCount,
  hasSelection,
  isSelected,
  allVisibleSelected: allVisibleSelectedFn,
  toggleSelection,
  toggleAllVisible: toggleAllVisibleFn,
  selectAll,
  clearSelection,
  resolveSelectedIds,
} = useBulkSelection({
  total: visibleCount,
  onSelectionChange: newSelection => emit('update:selection', newSelection),
});

// A filter change redefines what an active `all: true` selection covers, so
// clear the selection outright rather than letting it silently widen.
watch(
  () => props.globalFilter,
  () => clearSelection()
);

const allVisibleSelected = computed(() => allVisibleSelectedFn(visibleIds.value));

const headerCheckboxState = computed<boolean | 'indeterminate'>(() => {
  if (allVisibleSelected.value && visibleIds.value.length > 0) return true;
  if (hasSelection.value) return 'indeterminate';
  return false;
});

const handleToggleAllVisible = () => toggleAllVisibleFn(visibleIds.value);

/* ------------------------------------------------------------- bulk actions */

const pendingConfirmAction = ref<BulkAction | null>(null);
const pendingConfirmCount = ref(0);
const confirmResolver = ref<((confirmed: boolean) => void) | null>(null);

const bulkActionsApi = useBulkActions({
  selectedIds: () => resolveSelectedIds(visibleIds.value),
  clearSelection,
  invalidate: () => props.onBulkComplete?.(),
  confirmAction: (action, count) =>
    new Promise<boolean>(resolve => {
      if (!action.confirm) {
        resolve(true);
        return;
      }
      pendingConfirmAction.value = action;
      pendingConfirmCount.value = count;
      confirmResolver.value = resolve;
    }),
});

function settleConfirm(confirmed: boolean) {
  confirmResolver.value?.(confirmed);
  confirmResolver.value = null;
  pendingConfirmAction.value = null;
}

function runBulkAction(action: BulkAction) {
  bulkActionsApi.runAction(action);
}

/* --------------------------------------------------------------- row opening */

// A row only affords clicking when something actually happens on click: the
// parent is listening for `open`. Tables without a listener render as plain,
// non-interactive rows.
const attrs = useAttrs();
const rowIsInteractive = computed(() => Boolean(attrs.onOpen));

const handleOpen = (row: TData) => emit('open', row);
</script>

<template>
  <div class="w-full">
    <!-- Teleported into a results row when a target is provided, so it overlays
         the results count instead of shifting the table down. -->
    <Teleport
      :to="bulkActionsTarget ? `#${bulkActionsTarget}` : undefined"
      :disabled="!bulkActionsTargetExists"
    >
      <BulkActionsBar
        v-if="enableSelection"
        :class="bulkActionsTargetExists ? '' : 'mb-3'"
        :overlay="bulkActionsTargetExists"
        :selection-count="selectionCount"
        :total-count="visibleCount"
        :all-visible-selected="allVisibleSelected"
        @clear="clearSelection"
        @select-all="selectAll"
      >
        <template #actions>
          <slot name="bulk-actions" :selection="selection" :clear-selection="clearSelection">
            <Button
              v-for="action in bulkActions"
              :key="action.key"
              :variant="action.variant ?? 'outline'"
              size="sm"
              @click="runBulkAction(action)"
            >
              {{ action.label }}
            </Button>
          </slot>
        </template>
      </BulkActionsBar>
    </Teleport>

    <BulkConfirmDialog
      v-if="pendingConfirmAction?.confirm"
      :open="!!pendingConfirmAction"
      :confirm="pendingConfirmAction.confirm"
      :count="pendingConfirmCount"
      @confirm="settleConfirm(true)"
      @cancel="settleConfirm(false)"
      @update:open="
        open => {
          if (!open) settleConfirm(false);
        }
      "
    />

    <div v-if="isLoading" class="py-12 text-center">
      <p class="text-slate-500">Loading...</p>
    </div>
    <div v-else-if="tableRows.length === 0" class="py-12 text-center">
      <div class="text-slate-600">
        <slot name="empty">No items found. Try adjusting your filters.</slot>
      </div>
    </div>
    <div v-else>
      <!-- Card View -->
      <div
        v-if="viewMode === 'card'"
        class="grid grid-cols-1 gap-4 px-4 md:grid-cols-2 lg:grid-cols-3"
      >
        <slot name="card" :items="tableRows.map(r => r.original)" :on-open="handleOpen" />
      </div>

      <!-- Table View -->
      <div v-else class="overflow-x-auto rounded-lg">
        <table class="w-full border-collapse">
          <TableHeader
            :header-groups="table.getHeaderGroups()"
            :column-classes="columnClassesWithSelect"
          >
            <template v-if="expansionEnabled" #header-expander>
              <button
                v-if="expansionMode === 'toggle'"
                type="button"
                aria-label="Expand all rows"
                class="flex h-full w-full items-center justify-center px-2 py-2 text-slate-500 hover:text-slate-700"
                @click="toggleAllVisibleExpanded(visibleIds)"
              >
                <component
                  :is="
                    tableRows.length > 0 && visibleIds.every(id => expandedIds.has(id))
                      ? ChevronDown
                      : ChevronRight
                  "
                  class="size-4"
                />
              </button>
            </template>
            <template v-if="enableSelection" #header-select>
              <!-- The wrapper owns the click so the whole cell is a hit target.
                   Checkbox renders a <button> that would toggle again as the
                   event bubbles, undoing this one — pointer-events-none makes
                   the wrapper the single source of the toggle. It stays
                   keyboard-reachable, and Space/Enter on it fires
                   update:model-value without reaching this handler. -->
              <div
                class="flex h-full w-full cursor-pointer items-center justify-center px-2 py-2"
                @click.stop="handleToggleAllVisible()"
              >
                <Checkbox
                  :model-value="headerCheckboxState"
                  aria-label="Select all rows"
                  class="pointer-events-none"
                  @update:model-value="handleToggleAllVisible"
                />
              </div>
            </template>
          </TableHeader>
          <tbody>
            <template v-for="row in tableRows" :key="getRowId(row.original)">
              <tr
                class="group border-b border-slate-200 transition-colors"
                :class="[
                  rowIsInteractive ? 'cursor-pointer hover:bg-slate-50' : '',
                  { 'border-b-0': expansionEnabled && isRowExpanded(getRowId(row.original)) },
                  rowClass?.(row.original),
                ]"
                @click="rowIsInteractive && handleOpen(row.original)"
              >
                <td v-if="expansionEnabled" class="p-0" @click.stop>
                  <!-- The button fills the cell so the whole column is a hit
                       target, not just the chevron glyph. -->
                  <button
                    v-if="expansionMode === 'toggle'"
                    type="button"
                    class="flex h-full w-full items-center justify-center px-2 py-3 text-slate-500 hover:text-slate-700"
                    :aria-expanded="isRowExpanded(getRowId(row.original))"
                    :aria-label="
                      isRowExpanded(getRowId(row.original)) ? 'Collapse row' : 'Expand row'
                    "
                    @click="toggleRowExpanded(getRowId(row.original))"
                  >
                    <component
                      :is="isRowExpanded(getRowId(row.original)) ? ChevronDown : ChevronRight"
                      class="size-4"
                    />
                  </button>
                </td>
                <td
                  v-for="cell in row.getVisibleCells()"
                  :key="cell.id"
                  class="text-sm"
                  :class="[
                    columnClassesWithSelect?.[cell.column.id],
                    cell.column.id === 'select' && enableSelection ? '' : 'px-4 py-3',
                  ]"
                >
                  <template v-if="cell.column.id === 'select' && enableSelection">
                    <!-- See the header-select slot above for why the wrapper
                         handles the click and the Checkbox is pointer-inert. -->
                    <div
                      class="flex h-full w-full cursor-pointer items-center justify-center px-2 py-3"
                      @click.stop="toggleSelection(getRowId(row.original))"
                    >
                      <Checkbox
                        :model-value="isSelected(getRowId(row.original))"
                        aria-label="Select row"
                        class="pointer-events-none"
                        @update:model-value="toggleSelection(getRowId(row.original))"
                      />
                    </div>
                  </template>

                  <template v-else>
                    <slot
                      :name="`cell-${cell.column.id}`"
                      :cell="cell"
                      :row="row.original"
                      :value="cell.getValue()"
                    >
                      {{ cell.getValue() }}
                    </slot>
                  </template>
                </td>
              </tr>
              <tr
                v-if="expansionEnabled && isRowExpanded(getRowId(row.original))"
                class="border-b border-slate-200"
              >
                <td
                  :colspan="row.getVisibleCells().length + (expansionEnabled ? 1 : 0)"
                  class="bg-slate-50 px-4 py-3"
                >
                  <slot name="expanded-row" :row="row.original" />
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
