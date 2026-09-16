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

/**
 * Where the trigger line sits, as a percentage of the pane's height from the
 * top. A section becomes active when its heading crosses this line.
 *
 * A proportion rather than a fixed pixel offset: on a short window a fixed line
 * low in the viewport would sit past the fold, and on a tall one a fixed line
 * near the top would fire while the previous section still filled the screen.
 * Raise it to make the sidebar switch later (the heading must travel further
 * down before it counts), lower it to switch earlier. 50% is the middle of the
 * pane: the heading is unmistakably the thing you are looking at by the time
 * the highlight moves.
 */
export const SCROLL_SPY_TRIGGER_PERCENT = 50;

/**
 * How close to the bottom edge of the pane the end sentinel must sit before the
 * bottom rule applies, as a fraction of pane height -- 0.15 meaning "in the
 * last 15%".
 *
 * Guards against a page shorter than the viewport, where the sentinel is
 * visible at every scroll position and would otherwise pin the highlight to the
 * last section permanently, making the earlier ones unreachable. Deliberately
 * tight: the rule exists only for the genuine end of a long page, where the
 * sentinel is pressed right up against the bottom edge.
 */
const BOTTOM_ZONE_FRACTION = 0.15;

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
 * The active section is the last one whose *heading* has crossed a trigger line
 * in the upper part of the pane -- "the most recent heading you scrolled past",
 * which is what the eye actually tracks.
 *
 * This replaces an earlier approach that observed each whole `<section>` box
 * within a top band and took the first one still intersecting. Because a
 * section's box spans its full height, the outgoing section kept intersecting
 * until its *last row* left the band, so the highlight only advanced once the
 * incoming title had been on screen for some time and was already near the top
 * edge. Watching a zero-height marker at each heading makes the switch depend
 * on the heading's position alone, so tall and short sections behave alike.
 */
export function useScrollSpy({ sectionIds, root }: UseScrollSpyOptions) {
  const activeId = ref<string | null>(null);
  /** Sections whose heading currently sits above the trigger line. */
  const passed = new Set<string>();
  const stops: Array<() => void> = [];
  /** Set while the pane is scrolled to its end. */
  let atBottom = false;

  /*
   * Clicking a heading scrolls smoothly, which drags every section between here
   * and the target through the viewport. Without this guard the observer fires
   * for each one and the sidebar highlight flickers down the list before
   * settling -- so while a click-scroll is in flight, the clicked section wins
   * and observer updates are ignored.
   */
  let suppressUntil = 0;

  function ids() {
    return typeof sectionIds === 'function' ? sectionIds() : sectionIds.value;
  }

  function order(id: string) {
    return ids().indexOf(id);
  }

  function recompute() {
    if (Date.now() < suppressUntil) return;

    /*
     * At the end of the pane, the last section wins outright. A section shorter
     * than the gap between the trigger line and the bottom of the viewport can
     * never reach that line, so without this the final one or two headings
     * would be unreachable by scrolling -- you would hit the bottom of the page
     * with the sidebar still pointing at an earlier section.
     */
    if (atBottom) {
      const last = ids().at(-1);
      if (last !== undefined) {
        activeId.value = last;
        return;
      }
    }

    if (passed.size === 0) {
      /*
       * Above the first heading -- the page header is on screen. The first
       * section is the honest answer: the sidebar should not sit blank, and
       * nothing earlier exists to highlight.
       */
      const first = ids()[0];
      if (first !== undefined) activeId.value = first;
      return;
    }

    // The heading furthest down the page that is still above the line.
    activeId.value = [...passed].sort((a, b) => order(b) - order(a))[0] ?? null;
  }

  /**
   * Observe a section's heading marker -- a zero-height element at the top of
   * the section, not the section box itself.
   */
  function observe(el: ObservedElement, id: string) {
    const { stop } = useIntersectionObserver(
      // VueUse types this against the DOM's own element types, which are not in
      // scope under the test project's lib. The cast is confined to this call
      // rather than leaking `HTMLElement` into the signature above.
      el as Parameters<typeof useIntersectionObserver>[0],
      entries => {
        // Only the last entry per element reflects its current state.
        const entry = entries[entries.length - 1];
        if (!entry) return;

        /*
         * The observation band runs from the trigger line to the top of the
         * pane, so a marker inside it has scrolled past the line. When it is
         * outside, its position says which side: above the band (scrolled past,
         * still counts) or below it (not yet reached).
         *
         * Measured against `rootBounds.top` rather than viewport zero, because
         * `boundingClientRect` is viewport-relative while the band is
         * root-relative. Those coincide only when the root starts at the top of
         * the viewport; with a scrolling pane lower down the page, a marker
         * above the pane still reports a positive `top` and would be read as
         * "not yet reached".
         *
         * Reading the rect rather than tracking enter/exit direction keeps this
         * stateless, so a re-observe after a search lands in the right state
         * from its first callback.
         */
        const rootTop = entry.rootBounds?.top ?? 0;
        const isPassed = entry.isIntersecting || entry.boundingClientRect.top < rootTop;

        if (isPassed) passed.add(id);
        else passed.delete(id);

        recompute();
      },
      {
        root: root as NonNullable<Parameters<typeof useIntersectionObserver>[2]>['root'],
        /*
         * A band across the top of the pane, ending at the trigger line. The
         * negative bottom margin pulls the band's lower edge up to that line --
         * the complement of the trigger percentage -- so a marker intersects
         * only once its heading has reached it.
         */
        rootMargin: `0px 0px -${100 - SCROLL_SPY_TRIGGER_PERCENT}% 0px`,
        threshold: 0,
      }
    );
    stops.push(stop);
  }

  /**
   * Observe the end-of-content sentinel, so the last section can win once the
   * pane is scrolled to its end. Optional: without it everything else still
   * works, the final short sections just never activate.
   */
  function observeEnd(el: ObservedElement) {
    const { stop } = useIntersectionObserver(
      el as Parameters<typeof useIntersectionObserver>[0],
      entries => {
        const entry = entries[entries.length - 1];
        if (!entry) return;

        /*
         * "Scrolled to the end", not merely "the end is visible".
         *
         * Plain visibility is true at every scroll position on a page shorter
         * than the viewport -- which a search easily produces -- and because
         * `recompute` lets the bottom win outright, the sidebar would pin
         * itself to the last section and the earlier ones could never be
         * highlighted at all. Requiring the sentinel to be in the bottom
         * portion of the pane keeps this to the case it is meant for: the
         * final short section that can never reach the trigger line.
         */
        const bounds = entry.rootBounds;
        atBottom = bounds
          ? entry.isIntersecting &&
            entry.boundingClientRect.top >= bounds.top + bounds.height * (1 - BOTTOM_ZONE_FRACTION)
          : false;

        recompute();
      },
      {
        root: root as NonNullable<Parameters<typeof useIntersectionObserver>[2]>['root'],
        threshold: 0,
      }
    );
    stops.push(stop);
  }

  /** Call when a heading is clicked, so the highlight lands immediately. */
  /*
   * 900ms rather than 700: smooth scrolls on this page were measured at
   * 724-730ms, so the old window expired while the scroll was still moving and
   * left no headroom on a slower machine.
   */
  function setActive(id: string, suppressMs = 900) {
    activeId.value = id;
    suppressUntil = Date.now() + suppressMs;
  }

  function reset() {
    stops.forEach(stop => stop());
    stops.length = 0;
    passed.clear();
    atBottom = false;
    /*
     * The active section is dropped along with the observers. Keeping it would
     * leave the sidebar highlighting a heading that a search has since filtered
     * away, and would make the arrow keys count from a section that is no
     * longer in the list.
     */
    activeId.value = null;
  }

  onBeforeUnmount(reset);

  return { activeId, observe, observeEnd, setActive, reset };
}
