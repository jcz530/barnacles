import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from '@tanstack/vue-table';

/**
 * The feature set every DataTable is built with.
 *
 * v9 features are opt-in plugins: whatever is not registered here is not
 * bundled. The core row model is implicit and needs no entry.
 *
 * Unlike a server-driven table, everything here runs against data already in
 * memory — Barnacles reads projects, ports, hosts and aliases from the local
 * Electron backend in full — so filtering and sorting are both registered and
 * done client-side. Pagination and grouping are not registered because no list
 * page paginates or groups.
 *
 * The sortFns/filterFns registries are what make a string `sortFn: 'datetime'`
 * or `filterFn: 'includesString'` in a ColumnDef resolve; only the built-ins
 * call sites actually reference are listed, since each one imported is one
 * more in the bundle. A function passed directly to a column needs no entry.
 */
export const features = tableFeatures({
  // Not (yet) about hiding columns: in v9 `row.getVisibleCells()` moved onto
  // this feature, and the row template calls it for every cell. Without it
  // registered, rows have no cells to render at all.
  columnVisibilityFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  // Global filtering backs the search boxes on the Aliases and Hosts tables;
  // column filtering comes along because the filtered row model needs it.
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
  filterFns: {
    includesString: filterFn_includesString,
  },
});

/**
 * Derived from the `features` value rather than written out by hand: v9 keys a
 * feature's API off the keys present in the type, so the two must not drift.
 * Consumers need it to type their columns:
 * `createColumnHelper<DataTableFeatures, Row>()`.
 */
export type DataTableFeatures = typeof features;
