import { describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';
import {
  CONFIGURE_PROCESSES,
  useConfigureProcessesParam,
} from '@/composables/useConfigureProcessesParam';

/**
 * Run the composable inside a scope, the way a component would, and hand back
 * the pieces a test needs to drive it.
 *
 * An effect scope rather than a mounted component: this composable only watches
 * refs, so there is nothing to render, and the scope gives the watchers the
 * owner they need without a renderer.
 */
const setup = (param: unknown = undefined, ready = false) => {
  const paramRef = ref<unknown>(param);
  const readyRef = ref(ready);
  const open = vi.fn();
  const scope = effectScope();

  scope.run(() => useConfigureProcessesParam(paramRef, readyRef, open));

  return { paramRef, readyRef, open, scope };
};

describe('useConfigureProcessesParam', () => {
  it('does nothing without the param', async () => {
    const { readyRef, open } = setup(undefined, false);

    readyRef.value = true;
    await nextTick();

    expect(open).not.toHaveBeenCalled();
  });

  it('does nothing for a param value it does not recognise', async () => {
    // Validated rather than trusted: an unknown value should not open anything.
    const { readyRef, open } = setup('something-else', false);

    readyRef.value = true;
    await nextTick();

    expect(open).not.toHaveBeenCalled();
  });

  it('waits for the processes to load before opening', async () => {
    // The whole point of the watcher. The editor picks its mode from the
    // process list as it opens, so opening early shows the wrong one -- and the
    // floating palette can raise a main window from cold, where navigation
    // happens long before any query resolves.
    const { readyRef, open } = setup(CONFIGURE_PROCESSES, false);

    expect(open).not.toHaveBeenCalled();

    readyRef.value = true;
    await nextTick();

    expect(open).toHaveBeenCalledTimes(1);
  });

  it('opens immediately when the processes are already loaded', () => {
    // The warm case: navigating in-app to a project whose processes are cached.
    const { open } = setup(CONFIGURE_PROCESSES, true);

    expect(open).toHaveBeenCalledTimes(1);
  });

  it('opens once, and not again when the param churns', async () => {
    // Closing the editor must not be undone by an unrelated re-evaluation --
    // the param stays in the URL, since nothing clears it.
    const { paramRef, readyRef, open } = setup(CONFIGURE_PROCESSES, false);

    readyRef.value = true;
    await nextTick();
    expect(open).toHaveBeenCalledTimes(1);

    paramRef.value = undefined;
    await nextTick();
    paramRef.value = CONFIGURE_PROCESSES;
    await nextTick();

    expect(open).toHaveBeenCalledTimes(1);
  });

  it('does not reopen when the query refetches', async () => {
    const { readyRef, open } = setup(CONFIGURE_PROCESSES, false);

    readyRef.value = true;
    await nextTick();

    // A refetch flips isFetched back and forth; the editor must not pop open
    // again behind whatever the person is doing by then.
    readyRef.value = false;
    await nextTick();
    readyRef.value = true;
    await nextTick();

    expect(open).toHaveBeenCalledTimes(1);
  });
});
