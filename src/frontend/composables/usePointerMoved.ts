import { readonly, ref, type Ref } from 'vue';
import { useEventListener } from '@vueuse/core';

/**
 * The part of a pointer event this needs.
 *
 * Structural rather than `PointerEvent` so the handler can be called from the
 * tests, which run in vitest's `node` environment with no DOM lib at all --
 * tsconfig.test.json sets `"lib": ["ESNext"]`, so naming `PointerEvent` here
 * would fail type-check:test. A real PointerEvent satisfies this shape, so the
 * listener below still wires up without a cast.
 */
export interface PointerPosition {
  screenX: number;
  screenY: number;
}

/**
 * Has the mouse actually moved since the palette was opened?
 *
 * Exists to keep the command palette from opening onto whatever row happens to
 * be under the cursor. reka-ui highlights a row on `pointermove` rather than
 * `pointerenter`, and the floating palette window is centred on whichever
 * display the cursor is on -- so it materialises *underneath* a stationary
 * pointer, the browser fires a synthetic pointermove for the element now beneath
 * it, and that row takes the highlight away from the first one. The person
 * never moved the mouse, so the palette should not act as though they had.
 *
 * Bound to ComboboxRoot's `highlight-on-hover`, which reka reads at event time:
 * while this is false the hover branch is skipped entirely and the keyboard's
 * own highlight -- the first row -- stands. Hover resumes the moment the mouse
 * genuinely moves, so pointing at a row still works normally.
 *
 * Kept out of the .vue file so it can be tested: the renderer's test environment
 * has no DOM, which is the same reason useLevelStack and useCommandStatus live
 * where they do.
 */
export const usePointerMoved = (): {
  moved: Readonly<Ref<boolean>>;
  arm: () => void;
  handlePointerMove: (event: PointerPosition) => void;
} => {
  const moved = ref(false);

  /**
   * The last place the pointer reported being.
   *
   * Screen coordinates, not client ones. The floating window is repositioned
   * before every show, so client coordinates are measured against a brand-new
   * window origin each time and cannot be compared across opens. Screen
   * coordinates are absolute, which is what lets a position recorded during one
   * open still mean something at the next -- including on another display.
   *
   * Deliberately *not* cleared by arm(). The main process shows the window
   * before it sends the "opened" message (see showCommandPalette), so there is a
   * gap in which the window is on screen and arm() has not run yet. Keeping the
   * last known position means a pointer that has not moved is recognised as
   * stationary the instant the window appears, rather than only once the message
   * lands -- which is what closes that gap.
   */
  let last: PointerPosition | null = null;

  /**
   * Close the gate again, for a fresh open.
   *
   * Only the verdict is reset; where the pointer was is knowledge worth keeping.
   */
  const arm = () => {
    moved.value = false;
  };

  /**
   * Decide whether this event represents a real move.
   *
   * An event at coordinates the pointer already occupied is not a move, however
   * many times it arrives -- that is the synthetic event the browser fires when
   * a window appears beneath a stationary cursor. Only a change of position
   * counts, so the gate opens on the first event that actually goes somewhere.
   *
   * The very first event of all has nothing to compare against and is taken as a
   * reading rather than a move, which costs at most one pixel of hover at the
   * start of a genuine movement -- imperceptible at pointermove's report rate.
   */
  const handlePointerMove = (event: PointerPosition) => {
    const previous = last;
    // Recorded even once the gate is open, so the next arm() has somewhere to
    // measure from without waiting for another event.
    last = { screenX: event.screenX, screenY: event.screenY };

    if (moved.value || previous === null) return;
    if (event.screenX === previous.screenX && event.screenY === previous.screenY) return;

    moved.value = true;
  };

  // On `window` because the pointer has to be followed wherever it is, not only
  // over the list.
  //
  // The guard is for the bare `window` below, not for useEventListener, which
  // copes with a nullish target on its own: these tests run in vitest's `node`
  // environment, where naming `window` at all is a ReferenceError.
  if (typeof window !== 'undefined') {
    useEventListener(window, 'pointermove', handlePointerMove);
  }

  // handlePointerMove is returned for the tests. The listener above is the only
  // caller in the app, but the renderer's test environment has no DOM to
  // dispatch through, so the handler has to be reachable directly.
  return { moved: readonly(moved), arm, handlePointerMove };
};
