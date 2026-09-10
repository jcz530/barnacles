import { ref, watch, type Ref } from 'vue';

/**
 * The one value `?configure=` takes.
 *
 * Exported so the command palette builds its deep link from the same constant
 * this page matches against, rather than the two agreeing by coincidence.
 */
export const CONFIGURE_PROCESSES = 'processes';

/**
 * Opens the start-process editor when the URL asks for it.
 *
 * The command palette sends a project with no start command here: configuring
 * one means the process editor, and only the project page has it.
 *
 * Two things make this a watcher rather than a read on mount. The editor picks
 * quick or advanced mode from the project's process list at the instant it
 * opens, so opening before that list has loaded shows quick mode -- and an
 * empty list -- for a project that may well have processes. And the floating
 * palette can raise a main window from cold, where navigation happens long
 * before any query resolves. Waiting for `ready` covers both.
 *
 * It fires once. The param is deliberately not cleared afterwards: rewriting
 * the URL to reflect UI state is not what this app does elsewhere, and tab
 * links carry no query, so binding the editor to the param would make a tab
 * click silently close it.
 */
export const useConfigureProcessesParam = (
  param: Ref<unknown>,
  ready: Ref<boolean>,
  open: () => void
): void => {
  const handled = ref(false);

  watch(
    [param, ready] as const,
    ([value, isReady]) => {
      if (handled.value) return;
      // Validated rather than trusted, so an unrecognised value does nothing
      // rather than opening something arbitrary.
      if (value !== CONFIGURE_PROCESSES || !isReady) return;

      handled.value = true;
      open();
    },
    { immediate: true }
  );
};
