import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';

/**
 * `useIntersectionObserver` is stubbed so the tests can drive intersection
 * callbacks directly. The real one needs a layout engine, and what is worth
 * testing here is the choice of active section, not the browser's geometry.
 */
interface StubEntry {
  isIntersecting: boolean;
  boundingClientRect: { top: number };
  rootBounds: { top: number; height: number } | null;
}

const observers: Array<{ el: unknown; cb: (entries: StubEntry[]) => void }> = [];

/**
 * Stand-in viewport geometry. The trigger line sits at 50% of this, matching
 * `SCROLL_SPY_TRIGGER_PERCENT`, so the positions below are the ones a real
 * browser would report.
 */
const VIEWPORT = { top: 0, height: 1000 };

vi.mock('@vueuse/core', () => ({
  useIntersectionObserver: (el: unknown, cb: (entries: StubEntry[]) => void) => {
    observers.push({ el, cb });
    return { stop: vi.fn() };
  },
}));

// onBeforeUnmount outside a component instance warns; the composable only uses
// it for cleanup, which these tests drive explicitly via reset().
vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue');
  return { ...actual, onBeforeUnmount: vi.fn() };
});

import { useScrollSpy, SCROLL_SPY_TRIGGER_PERCENT } from './useScrollSpy';

/**
 * Drive one section marker's observer from a real pixel position.
 *
 * Derives `isIntersecting` the way a browser would -- the band runs from the
 * root's top down to the trigger line -- so the stub cannot disagree with the
 * geometry it claims to represent.
 */
function markerAt(index: number, top: number, viewport = VIEWPORT) {
  const triggerLine = viewport.top + (viewport.height * SCROLL_SPY_TRIGGER_PERCENT) / 100;
  observers[index].cb([
    {
      isIntersecting: top >= viewport.top && top < triggerLine,
      boundingClientRect: { top },
      rootBounds: viewport,
    },
  ]);
}

/**
 * Drive one section marker by state rather than pixels, for the cases where
 * the exact position does not matter.
 *
 * - `below`: heading not yet reached the trigger line.
 * - `atLine`: heading is in the band between the line and the top of the pane.
 * - `above`: heading has scrolled off the top of the pane.
 */
function marker(index: number, state: 'below' | 'atLine' | 'above') {
  const positions = { below: 800, atLine: 300, above: -200 };
  markerAt(index, positions[state]);
}

/** Drive the end-of-content sentinel's observer from a real pixel position. */
function endSentinelAt(index: number, top: number, viewport = VIEWPORT) {
  observers[index].cb([
    {
      isIntersecting: top >= viewport.top && top < viewport.top + viewport.height,
      boundingClientRect: { top },
      rootBounds: viewport,
    },
  ]);
}

/** The sentinel at the very bottom of the pane: genuinely scrolled to the end. */
function endSentinel(index: number, isAtEnd: boolean) {
  endSentinelAt(index, isAtEnd ? 950 : 1400);
}

describe('useScrollSpy', () => {
  beforeEach(() => {
    observers.length = 0;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(ids = ['one', 'two', 'three']) {
    const sectionIds = ref(ids);
    const spy = useScrollSpy({ sectionIds });
    ids.forEach((id, i) => spy.observe({ id: i }, id));
    return spy;
  }

  it('activates a section as its heading reaches the trigger line', () => {
    const { activeId } = setup();
    marker(0, 'atLine');
    expect(activeId.value).toBe('one');
  });

  it('switches as soon as the next heading reaches the line', () => {
    const { activeId } = setup();

    marker(0, 'above');
    expect(activeId.value).toBe('one');

    /*
     * The regression this composable was rewritten for: the previous section's
     * body is still filling the screen, but the next heading has arrived at the
     * line, so that is the section you are looking at.
     */
    marker(1, 'atLine');
    expect(activeId.value).toBe('two');
  });

  it('does not switch while the next heading is still below the line', () => {
    const { activeId } = setup();

    marker(0, 'atLine');
    // Section two is on screen further down, but has not reached the line.
    marker(1, 'below');
    expect(activeId.value).toBe('one');
  });

  it('goes back to the previous section when scrolling up past the line', () => {
    const { activeId } = setup();

    marker(0, 'above');
    marker(1, 'atLine');
    expect(activeId.value).toBe('two');

    // Scrolling up: two's heading drops back below the line.
    marker(1, 'below');
    expect(activeId.value).toBe('one');
  });

  it('tracks the furthest heading past the line, not the most recent callback', () => {
    const { activeId } = setup();

    // A fast scroll can deliver these in any order.
    marker(2, 'above');
    marker(0, 'above');
    marker(1, 'above');

    expect(activeId.value).toBe('three');
  });

  it('shows the first section while the page header is still on screen', () => {
    const { activeId } = setup();

    // Nothing has reached the line yet -- the sidebar should not sit blank.
    marker(0, 'below');
    expect(activeId.value).toBe('one');
  });

  it('activates the last section once the end of the content is reached', () => {
    const spy = setup();
    spy.observeEnd({ id: 'end' });
    const endIndex = observers.length - 1;

    // A final section too short to ever reach the trigger line.
    marker(0, 'above');
    marker(1, 'above');
    expect(spy.activeId.value).toBe('two');

    endSentinel(endIndex, true);
    expect(spy.activeId.value).toBe('three');
  });

  it('resumes normal tracking after scrolling back up from the bottom', () => {
    const spy = setup();
    spy.observeEnd({ id: 'end' });
    const endIndex = observers.length - 1;

    marker(0, 'above');
    marker(1, 'above');
    endSentinel(endIndex, true);
    expect(spy.activeId.value).toBe('three');

    endSentinel(endIndex, false);
    expect(spy.activeId.value).toBe('two');
  });

  it('keeps every section reachable on a page shorter than the viewport', () => {
    /*
     * A search can filter the page down to less than a screenful, leaving the
     * end sentinel visible at every scroll position. Treating "sentinel
     * visible" as "scrolled to the end" pinned the highlight to the last
     * section, so the earlier ones could never be highlighted at all -- worse
     * than the lateness this composable was written to fix.
     */
    const spy = setup(['updates', 'developer-tools']);
    spy.observeEnd({ id: 'end' });
    const endIndex = observers.length - 1;

    // Short page: the sentinel is on screen, but only part-way down.
    endSentinelAt(endIndex, 561);

    /*
     * At the top of that page the first heading has crossed the line and the
     * second has not -- true at any trigger between 20% and 90%, so this tests
     * reachability rather than the exact line position.
     *
     * Asserting on `activeId` alone would pass even with the bug, because the
     * marker logic happens to agree here. Scrolling up so that *no* heading has
     * crossed the line is the case that separates them: the honest answer is
     * still the first section, while a permanently-true `atBottom` insists on
     * the last one.
     */
    markerAt(0, 100);
    markerAt(1, 950);
    expect(spy.activeId.value).toBe('updates');

    markerAt(0, 700);
    markerAt(1, 950);
    expect(spy.activeId.value).toBe('updates');
  });

  it('still honours the bottom rule when genuinely scrolled to the end', () => {
    const spy = setup();
    spy.observeEnd({ id: 'end' });
    const endIndex = observers.length - 1;

    marker(0, 'above');
    marker(1, 'above');

    // The sentinel sits low in the pane: the content really has run out.
    endSentinelAt(endIndex, 950);
    expect(spy.activeId.value).toBe('three');
  });

  it('measures a marker against the root, not the viewport', () => {
    /*
     * With a scrolling pane part-way down the page, `boundingClientRect` is
     * still viewport-relative while the observation band is root-relative. A
     * marker that has scrolled above such a pane reports a positive `top`, and
     * comparing that against zero would read it as "not yet reached".
     */
    const pane = { top: 300, height: 600 };
    const spy = setup();

    /*
     * Marker one sits at viewport 150 -- above the pane, which starts at 300,
     * so it has scrolled past. Measured against viewport zero instead, its
     * positive `top` reads as "not yet reached" and the section silently
     * un-highlights.
     *
     * Marker two is inside the pane but below its trigger line (300 + 50% of
     * 600 = 600), so it has not been reached either way.
     */
    markerAt(0, 150, pane);
    markerAt(1, 250, pane);

    /*
     * Both markers are above the pane's top edge, so both have been passed and
     * the later one wins. Measured against viewport zero, neither counts as
     * passed and the empty-set fallback answers 'one' -- so asserting 'two'
     * here distinguishes the fix from the bug, which asserting 'one' would
     * not.
     */
    expect(spy.activeId.value).toBe('two');
  });

  it('handles several markers delivered in one callback batch', () => {
    // Real IntersectionObservers batch entries; the composable reads only the
    // last entry per element, so each element still needs its own callback.
    const spy = setup();

    markerAt(0, -200);
    markerAt(1, -50);
    markerAt(2, 700);

    expect(spy.activeId.value).toBe('two');
  });

  it('holds the clicked section while the smooth scroll is in flight', () => {
    const { activeId, setActive } = setup();

    setActive('three');
    expect(activeId.value).toBe('three');

    // Sections sweeping past during the scroll must not steal the highlight.
    marker(0, 'above');
    marker(1, 'atLine');
    expect(activeId.value).toBe('three');
  });

  it('resumes tracking once the scroll settles', () => {
    const { activeId, setActive } = setup();

    setActive('three', 700);
    marker(0, 'atLine');
    expect(activeId.value).toBe('three');

    vi.advanceTimersByTime(800);
    marker(1, 'below');
    expect(activeId.value).toBe('one');
  });

  it('forgets the active section on reset', () => {
    const { activeId, reset } = setup();
    marker(0, 'atLine');
    expect(activeId.value).toBe('one');

    // A search changes which sections exist. Keeping the old active id would
    // highlight a heading that is no longer on the page, and would make the
    // arrow keys count from a section that is not in the list.
    reset();
    expect(activeId.value).toBeNull();
  });

  it('clears the bottom state on reset', () => {
    const spy = setup();
    spy.observeEnd({ id: 'end' });
    endSentinel(observers.length - 1, true);
    expect(spy.activeId.value).toBe('three');

    /*
     * A search that filters the list re-attaches everything. If `atBottom`
     * survived, the first callback would snap to the last of the *new* list
     * regardless of where the pane is actually scrolled.
     */
    spy.reset();
    observers.length = 0;
    const ids = ['one', 'two'];
    ids.forEach((id, i) => spy.observe({ id: i }, id));

    marker(0, 'atLine');
    expect(spy.activeId.value).toBe('one');
  });

  it('stops observing after reset', () => {
    const spy = setup();
    expect(observers).toHaveLength(3);
    spy.reset();

    // Sections re-register after a search changes which ones are mounted.
    spy.observe({ id: 9 }, 'one');
    expect(observers).toHaveLength(4);
  });

  it('settles correctly when re-observed mid-page after a search', () => {
    const spy = setup();
    spy.reset();
    observers.length = 0;

    /*
     * Re-attaching does not scroll the pane, so the first callback for each
     * marker carries its real position. Reading the rect rather than tracking
     * enter/exit direction is what lets this land in the right state straight
     * away.
     */
    const ids = ['one', 'two', 'three'];
    ids.forEach((id, i) => spy.observe({ id: i }, id));

    marker(0, 'above');
    marker(1, 'above');
    marker(2, 'below');

    expect(spy.activeId.value).toBe('two');
  });
});
