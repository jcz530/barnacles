import { ref, watch, type Ref } from 'vue';

/**
 * The query param naming which process the processes tab should open on.
 *
 * Exported so the command palette builds its deep link from the same constant
 * this page matches against, rather than the two agreeing by coincidence.
 */
export const SELECTED_PROCESS_PARAM = 'process';

/**
 * Picks which process the processes tab opens on.
 *
 * The command palette's View Output verb knows exactly which process someone
 * meant, and sends it here as `?process=<id>`. Without this the tab opened on
 * the empty state and made them find the same process again in the sidebar.
 *
 * A watcher rather than a read on setup, for the reason the tab's previous
 * auto-select got wrong: the process list arrives from a query, so anything
 * that reads it synchronously reads an empty list. The floating palette makes
 * this sharper still -- it can raise a main window from cold, where navigation
 * happens long before any query resolves. Waiting for `ready` covers both.
 *
 * Falls back to the first process whenever the requested one is not there,
 * which also covers the no-param case of an ordinary tab click. A stopped
 * process has its entry deleted outright, so a palette listing that has gone
 * stale points at an id that no longer exists -- common enough that it should
 * land on something useful rather than nothing.
 *
 * Takes the selection ref rather than a setter, so it can see a choice that
 * was already made and leave it alone.
 *
 * The param is consumed: it names where to *arrive*, not what is selected now,
 * and `clear` drops it once it has been honoured. Unlike ?configure=, which is
 * read by the project page and survives for as long as that page does, this
 * runs in a tab that remounts every time someone leaves it and comes back. A
 * param left in the URL would re-fire then and yank the pane back to the
 * palette's choice -- tearing down a live terminal and its scrollback -- long
 * after the person had picked something else by hand.
 */
export const useSelectedProcessParam = (
  param: Ref<unknown>,
  ready: Ref<boolean>,
  processIds: Ref<string[]>,
  selected: Ref<string | null>,
  clear: () => void
): void => {
  const handled = ref(false);

  watch(
    [param, ready, processIds] as const,
    ([value, isReady, ids]) => {
      if (handled.value || !isReady) return;

      // Nothing to select is not a failure -- a project with no processes is
      // the ordinary empty state, and a later run must still be allowed once
      // one starts.
      if (ids.length === 0) return;

      handled.value = true;

      // Someone got here first: running a script from the sidebar selects the
      // process it just created, and on a project that started empty that can
      // land while this is still waiting for a list. Their choice wins.
      if (selected.value !== null) {
        if (typeof value === 'string') clear();
        return;
      }

      // Validated against what actually loaded rather than trusted, so a stale
      // or bogus id falls back instead of selecting something that isn't there.
      selected.value = typeof value === 'string' && ids.includes(value) ? value : ids[0];

      // Only worth a history rewrite when there was actually a param to spend.
      if (typeof value === 'string') clear();
    },
    { immediate: true }
  );
};
