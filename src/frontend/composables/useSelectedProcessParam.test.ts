import { describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref, type Ref } from 'vue';
import { useSelectedProcessParam } from '@/composables/useSelectedProcessParam';

/**
 * Run the composable inside a scope, the way a component would, and hand back
 * the pieces a test needs to drive it.
 *
 * An effect scope rather than a mounted component: this composable only watches
 * refs, so there is nothing to render, and the scope gives the watchers the
 * owner they need without a renderer.
 *
 * The selection is a real ref, not a spy, because what matters is the value the
 * pane ends up showing -- including the cases where this must leave alone a
 * choice something else already made.
 */
const setup = (
  param: unknown = undefined,
  ready = false,
  ids: string[] = [],
  selected: Ref<string | null> = ref<string | null>(null)
) => {
  const paramRef = ref<unknown>(param);
  const readyRef = ref(ready);
  const idsRef = ref<string[]>(ids);
  const clear = vi.fn();
  const scope = effectScope();

  scope.run(() => useSelectedProcessParam(paramRef, readyRef, idsRef, selected, clear));

  return { paramRef, readyRef, idsRef, selected, clear, scope };
};

describe('useSelectedProcessParam', () => {
  it('selects the process the param names', async () => {
    const { readyRef, selected } = setup('api', false, ['web', 'api']);

    readyRef.value = true;
    await nextTick();

    // Not the first one. Carrying the palette's choice through is the point.
    expect(selected.value).toBe('api');
  });

  it('waits for the processes to load before selecting', async () => {
    // The whole point of the watcher. The floating palette can raise a main
    // window from cold, where navigation happens long before any query
    // resolves; a synchronous read would see an empty list and select nothing.
    const { readyRef, idsRef, selected } = setup('api', false, []);

    expect(selected.value).toBeNull();

    readyRef.value = true;
    idsRef.value = ['web', 'api'];
    await nextTick();

    expect(selected.value).toBe('api');
  });

  it('selects immediately when the processes are already loaded', () => {
    // The warm case: navigating in-app to a project whose processes are cached.
    const { selected } = setup('api', true, ['web', 'api']);

    expect(selected.value).toBe('api');
  });

  it('falls back to the first process when the requested one is gone', async () => {
    // Stopping deletes a process's entry outright, so a palette listing that
    // has gone stale points at an id that no longer exists. Landing on
    // something beats landing on the empty state.
    const { readyRef, selected } = setup('api', false, ['web']);

    readyRef.value = true;
    await nextTick();

    expect(selected.value).toBe('web');
  });

  it('falls back to the first process when no param is given', async () => {
    // An ordinary tab click. The tab's previous auto-select ran during setup,
    // before the query resolved, so it never actually fired.
    const { readyRef, selected } = setup(undefined, false, ['web', 'api']);

    readyRef.value = true;
    await nextTick();

    expect(selected.value).toBe('web');
  });

  it('selects nothing while there are no processes', async () => {
    const { readyRef, selected } = setup(undefined, false, []);

    readyRef.value = true;
    await nextTick();

    expect(selected.value).toBeNull();
  });

  it('still selects once a process appears later', async () => {
    // An empty project is not a settled answer -- someone starting a process
    // from the sidebar should land on it.
    const { readyRef, idsRef, selected } = setup(undefined, true, []);

    readyRef.value = true;
    await nextTick();
    expect(selected.value).toBeNull();

    idsRef.value = ['web'];
    await nextTick();

    expect(selected.value).toBe('web');
  });

  it('leaves alone a process something else already selected', async () => {
    // Running a script from the sidebar selects the process it just created.
    // On a project that started empty that lands while this is still waiting
    // for a list, and it must not be overridden by the first-item default.
    const chosen = ref<string | null>('worker');
    const { readyRef, selected } = setup(undefined, false, ['web', 'api'], chosen);

    readyRef.value = true;
    await nextTick();

    expect(selected.value).toBe('worker');
  });

  it('does not reselect after the person picks another process', async () => {
    // Selection is theirs to change once this has run. A refetch, or a process
    // starting or stopping, must not yank the pane back.
    const { idsRef, readyRef, selected } = setup('api', false, ['web', 'api']);

    readyRef.value = true;
    await nextTick();
    expect(selected.value).toBe('api');

    selected.value = 'web';
    idsRef.value = ['web', 'api', 'worker'];
    await nextTick();
    readyRef.value = false;
    await nextTick();
    readyRef.value = true;
    await nextTick();

    expect(selected.value).toBe('web');
  });

  it('ignores a param that is not a string', async () => {
    // Vue router hands back an array when a param repeats.
    const { readyRef, selected } = setup(['web', 'api'], false, ['web', 'api']);

    readyRef.value = true;
    await nextTick();

    expect(selected.value).toBe('web');
  });

  it('spends the param once it has been honoured', async () => {
    // Left in the URL it would re-fire on the next remount -- every tab switch
    // away and back -- and drag the pane off whatever was chosen since.
    const { readyRef, clear } = setup('api', false, ['web', 'api']);

    readyRef.value = true;
    await nextTick();

    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('does not rewrite the url when there was no param to spend', async () => {
    const { readyRef, clear } = setup(undefined, false, ['web', 'api']);

    readyRef.value = true;
    await nextTick();

    expect(clear).not.toHaveBeenCalled();
  });

  it('does not re-select on a remount once the param has been spent', async () => {
    // What a tab switch away and back looks like: a fresh instance, but the
    // param is gone from the URL by then, so the person's own choice stands.
    const kept = ref<string | null>(null);
    const first = setup('api', true, ['web', 'api'], kept);
    expect(kept.value).toBe('api');
    expect(first.clear).toHaveBeenCalledTimes(1);

    kept.value = 'web';
    first.scope.stop();

    setup(undefined, true, ['web', 'api'], kept);

    expect(kept.value).toBe('web');
  });

  it('selects again for a different project, which mounts its own instance', () => {
    // Switching projects remounts the tab (ProjectDetail keys the router-view
    // by project), so a fresh instance must select from the new list rather
    // than inheriting the previous project's handled flag.
    const first = ref<string | null>(null);
    setup(undefined, true, ['web', 'api'], first);
    expect(first.value).toBe('web');

    const second = ref<string | null>(null);
    setup(undefined, true, ['other-app'], second);

    expect(second.value).toBe('other-app');
  });
});
