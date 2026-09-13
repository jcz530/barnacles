import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';

/**
 * `useIntersectionObserver` is stubbed so the tests can drive intersection
 * callbacks directly. The real one needs a layout engine, and what is worth
 * testing here is the choice of active section, not the browser's geometry.
 */
const observers: Array<{ el: unknown; cb: (entries: Array<{ isIntersecting: boolean }>) => void }> =
  [];

vi.mock('@vueuse/core', () => ({
  useIntersectionObserver: (
    el: unknown,
    cb: (entries: Array<{ isIntersecting: boolean }>) => void
  ) => {
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

import { useScrollSpy } from './useScrollSpy';

function intersect(index: number, isIntersecting: boolean) {
  observers[index].cb([{ isIntersecting }]);
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

  it('activates a section once it intersects', () => {
    const { activeId } = setup();
    intersect(0, true);
    expect(activeId.value).toBe('one');
  });

  it('prefers the earliest section in document order when several are visible', () => {
    const { activeId } = setup();

    // Scrolled so that the second and third are both on screen; the one you are
    // reading is the higher of the two.
    intersect(2, true);
    intersect(1, true);
    expect(activeId.value).toBe('two');
  });

  it('falls to the next section down when the current one scrolls away', () => {
    const { activeId } = setup();
    intersect(0, true);
    intersect(1, true);
    expect(activeId.value).toBe('one');

    intersect(0, false);
    expect(activeId.value).toBe('two');
  });

  it('keeps the last active section when nothing is intersecting', () => {
    const { activeId } = setup();
    intersect(1, true);
    expect(activeId.value).toBe('two');

    // Mid-flight between sections, the heading should not blank out.
    intersect(1, false);
    expect(activeId.value).toBe('two');
  });

  it('holds the clicked section while the smooth scroll is in flight', () => {
    const { activeId, setActive } = setup();

    setActive('three');
    expect(activeId.value).toBe('three');

    // Sections sweeping past during the scroll must not steal the highlight.
    intersect(0, true);
    intersect(1, true);
    expect(activeId.value).toBe('three');
  });

  it('resumes tracking once the scroll settles', () => {
    const { activeId, setActive } = setup();

    setActive('three', 700);
    intersect(0, true);
    expect(activeId.value).toBe('three');

    vi.advanceTimersByTime(800);
    intersect(1, true);
    expect(activeId.value).toBe('one');
  });

  it('stops observing after reset', () => {
    const spy = setup();
    expect(observers).toHaveLength(3);
    spy.reset();

    // Sections re-register after a search changes which ones are mounted.
    spy.observe({ id: 9 }, 'one');
    expect(observers).toHaveLength(4);
  });
});
