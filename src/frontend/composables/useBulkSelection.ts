import { computed, ref, type Ref } from 'vue';

export interface SelectionState {
  all: boolean;
  include: string[];
  exclude: string[];
}

export interface BulkSelectionOptions {
  /**
   * Total number of rows the table holds. Every row is loaded up front, so
   * this is simply the row count — but selection is still modelled as
   * all/include/exclude rather than a flat id list so that "select all" stays
   * correct when a filter narrows the visible set beneath it.
   */
  total?: Ref<number | null>;
  onSelectionChange?: (selection: SelectionState) => void;
}

export function useBulkSelection(options: BulkSelectionOptions = {}) {
  const { total, onSelectionChange } = options;

  const selection = ref<SelectionState>({
    all: false,
    include: [],
    exclude: [],
  });

  const selectionCount = computed(() => {
    if (selection.value.all) {
      return (total?.value ?? 0) - selection.value.exclude.length;
    }
    return selection.value.include.length;
  });

  const hasSelection = computed(() => selectionCount.value > 0);

  const isSelected = (id: string): boolean => {
    if (selection.value.all) {
      return !selection.value.exclude.includes(id);
    }
    return selection.value.include.includes(id);
  };

  const allVisibleSelected = (visibleIds: string[]): boolean => {
    return visibleIds.length > 0 && visibleIds.every(id => isSelected(id));
  };

  const toggleSelection = (id: string) => {
    if (selection.value.all) {
      const index = selection.value.exclude.indexOf(id);
      if (index > -1) {
        selection.value.exclude.splice(index, 1);
      } else {
        selection.value.exclude.push(id);
      }
    } else {
      const index = selection.value.include.indexOf(id);
      if (index > -1) {
        selection.value.include.splice(index, 1);
      } else {
        selection.value.include.push(id);
      }
    }
    onSelectionChange?.(selection.value);
  };

  const toggleAllVisible = (visibleIds: string[]) => {
    const allSelected = allVisibleSelected(visibleIds);

    if (allSelected) {
      // Deselect all visible. In "all" mode this clears the selection outright
      // (matching Gmail/Linear/Stripe): pushing every visible id into exclude
      // would leave `all: true` active with a bar still reporting a selection
      // while the header checkbox reads unchecked.
      if (selection.value.all) {
        selection.value = { all: false, include: [], exclude: [] };
      } else {
        visibleIds.forEach(id => {
          const index = selection.value.include.indexOf(id);
          if (index > -1) {
            selection.value.include.splice(index, 1);
          }
        });
      }
    } else if (selection.value.all) {
      visibleIds.forEach(id => {
        const index = selection.value.exclude.indexOf(id);
        if (index > -1) {
          selection.value.exclude.splice(index, 1);
        }
      });
    } else {
      visibleIds.forEach(id => {
        if (!selection.value.include.includes(id)) {
          selection.value.include.push(id);
        }
      });
    }

    onSelectionChange?.(selection.value);
  };

  const selectAll = () => {
    selection.value = { all: true, include: [], exclude: [] };
    onSelectionChange?.(selection.value);
  };

  const clearSelection = () => {
    selection.value = { all: false, include: [], exclude: [] };
    onSelectionChange?.(selection.value);
  };

  /**
   * The concrete ids a bulk action should operate on. With every row in
   * memory, an `all` selection can be resolved to a real id list here rather
   * than being handed to a server to reconstruct.
   */
  const resolveSelectedIds = (allIds: string[]): string[] => {
    if (selection.value.all) {
      return allIds.filter(id => !selection.value.exclude.includes(id));
    }
    return allIds.filter(id => selection.value.include.includes(id));
  };

  return {
    selection,
    selectionCount,
    hasSelection,
    isSelected,
    allVisibleSelected,
    toggleSelection,
    toggleAllVisible,
    selectAll,
    clearSelection,
    resolveSelectedIds,
  };
}
