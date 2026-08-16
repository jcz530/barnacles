import { ref } from 'vue';
import { toast } from 'vue-sonner';
import type { BulkAction, BulkResult } from '../types/bulk';

export interface UseBulkActionsOptions {
  /** Resolves the currently-selected row ids at the moment an action runs. */
  selectedIds: () => string[];
  clearSelection: () => void;
  /** Refresh data after a successful action (e.g. refetch a TanStack query). */
  invalidate?: () => void | Promise<void>;
  /**
   * Resolves once the user has confirmed (true) or cancelled (false) an action
   * that declares a `confirm` descriptor. Defaults to window.confirm so the
   * composable works headless; DataTable overrides it with BulkConfirmDialog.
   */
  confirmAction?: (action: BulkAction, count: number) => Promise<boolean>;
}

async function defaultConfirm(action: BulkAction, count: number): Promise<boolean> {
  if (!action.confirm) return true;
  return window.confirm(action.confirm.description(count));
}

export function useBulkActions(options: UseBulkActionsOptions) {
  const { selectedIds, clearSelection, invalidate, confirmAction = defaultConfirm } = options;

  const isRunning = ref(false);
  const pendingAction = ref<BulkAction | null>(null);

  async function runAction(action: BulkAction): Promise<BulkResult | null> {
    const ids = selectedIds();
    if (ids.length === 0) return null;

    const confirmed = await confirmAction(action, ids.length);
    if (!confirmed) return null;

    isRunning.value = true;
    try {
      const result = await action.run({ ids });
      const failed = result.failed ?? [];

      if (failed.length > 0 && result.affected === 0) {
        toast.error(result.message);
      } else if (failed.length > 0) {
        toast.warning(result.message);
      } else {
        toast.success(result.message);
      }

      // Clear before invalidating: the reverse re-renders with fresh data while
      // stale ids are still marked selected, flickering a wrong count.
      clearSelection();
      await invalidate?.();

      return result;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The bulk action failed.');
      throw error;
    } finally {
      isRunning.value = false;
      pendingAction.value = null;
    }
  }

  function requestAction(action: BulkAction) {
    pendingAction.value = action;
  }

  return { isRunning, pendingAction, runAction, requestAction };
}
