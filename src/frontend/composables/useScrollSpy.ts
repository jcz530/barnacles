import { ref, onBeforeUnmount, type Ref } from 'vue';
import { useIntersectionObserver } from '@vueuse/core';

/**
 * The element types are structural rather than `HTMLElement` so this module can
 * be imported by its own test: those run in vitest's `node` environment, where
 * `tsconfig.test.json` sets `"lib": ["ESNext"]` and the DOM globals do not
 * exist. A real element satisfies an empty shape, so callers pass one without a
 * cast. `usePointerMoved` avoids `PointerEvent` for the same reason.
 */
type ObservedElement = object;

interface UseScrollSpyOptions {
  /** Section ids to watch, in document order. */
  sectionIds: Ref<string[]> | (() => string[]);
  /**
   * The element that actually scrolls. In this app that is `SidebarInset`'s
   * `<main>`, not the window -- an observer left on the viewport would never
   * fire, because the viewport itself never moves.
   */
  root?: Ref<ObservedElement | null>;
}

/**
 * Tracks which section is currently in view and exposes it as `activeId`.
 *
 * Intersection ratios alone are not enough here: sections have wildly different
 * heights, so a short section fully on screen and a tall one half on screen both
 * look "visible". Instead we keep the set of currently-intersecting sections and
 * pick the first one in document order, which is what someone reading down the
 * page would call the section they are in.
 */
export function useScrollSpy({ sectionIds, root }: UseScrollSpyOptions) {
  const activeId = ref<string | null>(null);
  const visible = new Set<string>();
  const stops: Array<() => void> = [];

  /*
   * Clicking a heading scrolls smoothly, which drags every section between here
   * and the target through the viewport. Without this guard the observer fires
   * for each one and the sidebar highlight flickers down the list before
   * settling -- so while a click-scroll is in flight, the clicked section wins
   * and observer updates are ignored.
   */
  let suppressUntil = 0;

  function order(id: string) {
    const ids = typeof sectionIds === 'function' ? sectionIds() : sectionIds.value;
    return ids.indexOf(id);
  }

  function recompute() {
    if (Date.now() < suppressUntil) return;
    if (visible.size === 0) return;
    activeId.value = [...visible].sort((a, b) => order(a) - order(b))[0] ?? null;
  }

  function observe(el: ObservedElement, id: string) {
    const { stop } = useIntersectionObserver(
      // VueUse types this against the DOM's own element types, which are not in
      // scope under the test project's lib. The cast is confined to this call
      // rather than leaking `HTMLElement` into the signature above.
      el as Parameters<typeof useIntersectionObserver>[0],
      entries => {
        // Only the last entry per element reflects its current state.
        const isIntersecting = entries[entries.length - 1]?.isIntersecting ?? false;
        if (isIntersecting) visible.add(id);
        else visible.delete(id);
        recompute();
      },
      {
        root: root as NonNullable<Parameters<typeof useIntersectionObserver>[2]>['root'],
        /*
         * Bias the band towards the top of the pane. A section counts as "the
         * one you're reading" while its top sits in the upper portion of the
         * viewport; the large negative bottom margin stops a section that has
         * merely crept into view at the bottom from stealing the highlight.
         */
        rootMargin: '0px 0px -60% 0px',
        threshold: 0,
      }
    );
    stops.push(stop);
  }

  /** Call when a heading is clicked, so the highlight lands immediately. */
  function setActive(id: string, suppressMs = 700) {
    activeId.value = id;
    suppressUntil = Date.now() + suppressMs;
  }

  function reset() {
    stops.forEach(stop => stop());
    stops.length = 0;
    visible.clear();
  }

  onBeforeUnmount(reset);

  return { activeId, observe, setActive, reset };
}
