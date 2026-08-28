import { describe, it, expect } from 'vitest';
import { defineComponent, h, ref, computed, nextTick } from 'vue';
import { createRenderer } from '@vue/runtime-core';

// No DOM in this test env (vitest runs `environment: 'node'`), so drive Vue
// with a no-op host renderer. Lifecycle ordering is identical to the browser,
// which is the whole point of these tests.
const noop = () => {};
const { createApp } = createRenderer<any, any>({
  createElement: () => ({ children: [] }),
  createText: () => ({}),
  createComment: () => ({}),
  setText: noop,
  setElementText: noop,
  insert: noop,
  remove: noop,
  parentNode: () => null,
  nextSibling: () => null,
  patchProp: noop,
});
import { provideBreadcrumbs, useBreadcrumbs } from '@/composables/useBreadcrumbs';

/** Page that sets its crumb at setup() time. */
const setupPage = (label: string) =>
  defineComponent({
    name: `setup-${label}`,
    setup() {
      useBreadcrumbs().setBreadcrumbs([{ label }]);
      return () => h('div');
    },
  });

/** Page driven by a reactive source, like ProjectDetail. */
const reactivePage = (name: ReturnType<typeof ref<string>>) =>
  defineComponent({
    name: 'reactive',
    setup() {
      const { setBreadcrumbs } = useBreadcrumbs();
      setBreadcrumbs(computed(() => [{ label: name.value! }]));
      return () => h('div');
    },
  });

/** Mirrors DefaultLayout: stable provider + keyed router-view. */
function mountLayout(page: ReturnType<typeof ref<any>>) {
  let crumbs: any;
  const Root = defineComponent({
    setup() {
      crumbs = provideBreadcrumbs().breadcrumbs;
      // the :key forces a fresh mount/unmount pair per navigation
      return () => h(page.value, { key: page.value.name });
    },
  });
  const app = createApp(Root);
  app.mount({ children: [] });
  return { app, labels: () => crumbs.value.map((c: any) => c.label) };
}

describe('useBreadcrumbs navigation', () => {
  it('keeps the incoming page crumb when navigating (setup-time)', async () => {
    const page = ref<any>(setupPage('Projects'));
    const { labels } = mountLayout(page);
    expect(labels()).toEqual(['Projects']);

    page.value = setupPage('Ports');
    await nextTick();
    // Before the fix the outgoing unmount wiped this back to []
    expect(labels()).toEqual(['Ports']);
  });

  it('clears crumbs when the last owning page unmounts', async () => {
    const page = ref<any>(setupPage('Mcp'));
    const { app, labels } = mountLayout(page);
    expect(labels()).toEqual(['Mcp']);
    app.unmount();
    expect(labels()).toEqual([]);
  });

  it('stops the previous reactive source from overwriting the new page', async () => {
    const projectA = ref('Project A');
    const page = ref<any>(reactivePage(projectA));
    const { labels } = mountLayout(page);
    expect(labels()).toEqual(['Project A']);

    page.value = setupPage('Ports');
    await nextTick();
    expect(labels()).toEqual(['Ports']);

    // A stale refetch of the previous project must not clobber the new page
    projectA.value = 'Project A (refetched)';
    await nextTick();
    expect(labels()).toEqual(['Ports']);
  });
});
