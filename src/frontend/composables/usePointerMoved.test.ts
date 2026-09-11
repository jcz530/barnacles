import { describe, expect, it } from 'vitest';
import { usePointerMoved, type PointerPosition } from './usePointerMoved';

/** A pointer event's coordinates, which is all the gate reads. */
const at = (screenX: number, screenY: number): PointerPosition => ({ screenX, screenY });

describe('usePointerMoved', () => {
  it('starts closed, before any pointer event', () => {
    const { moved } = usePointerMoved();

    expect(moved.value).toBe(false);
  });

  /*
   * The bug this exists for. The floating palette window is centred on whichever
   * display the cursor is on, so it opens underneath a stationary pointer and the
   * browser fires one synthetic pointermove for the row now beneath it. Believing
   * that event is what highlighted a middle row instead of the first one.
   */
  it('does not open on the first event after arming', () => {
    const { moved, arm, handlePointerMove } = usePointerMoved();

    arm();
    handlePointerMove(at(400, 300));

    expect(moved.value).toBe(false);
  });

  it('stays closed while the pointer reports the same place', () => {
    const { moved, arm, handlePointerMove } = usePointerMoved();

    arm();
    handlePointerMove(at(400, 300));
    handlePointerMove(at(400, 300));
    handlePointerMove(at(400, 300));

    expect(moved.value).toBe(false);
  });

  it('opens once the pointer actually moves', () => {
    const { moved, arm, handlePointerMove } = usePointerMoved();

    arm();
    handlePointerMove(at(400, 300));
    handlePointerMove(at(412, 318));

    expect(moved.value).toBe(true);
  });

  // Movement along either axis counts on its own -- the two coordinates are
  // compared with "or", not "and".
  it.each([
    ['horizontal', at(401, 300)],
    ['vertical', at(400, 301)],
  ])('opens on %s movement alone', (_axis, destination) => {
    const { moved, arm, handlePointerMove } = usePointerMoved();

    arm();
    handlePointerMove(at(400, 300));
    handlePointerMove(destination);

    expect(moved.value).toBe(true);
  });

  // Hover should not blink off when the pointer happens back onto the pixel it
  // started from; the gate is one-way until the next open re-arms it.
  it('stays open when the pointer returns to where it started', () => {
    const { moved, arm, handlePointerMove } = usePointerMoved();

    arm();
    handlePointerMove(at(400, 300));
    handlePointerMove(at(450, 350));
    handlePointerMove(at(400, 300));

    expect(moved.value).toBe(true);
  });

  it('closes again when re-armed after movement', () => {
    const { moved, arm, handlePointerMove } = usePointerMoved();

    arm();
    handlePointerMove(at(400, 300));
    handlePointerMove(at(450, 350));
    expect(moved.value).toBe(true);

    arm();
    expect(moved.value).toBe(false);

    handlePointerMove(at(450, 350));
    expect(moved.value).toBe(false);

    handlePointerMove(at(451, 350));
    expect(moved.value).toBe(true);
  });

  /*
   * The reopen race. The main process shows the floating window *before* it
   * sends the message that arms the gate, so on every open after the first
   * there is a gap where the window is on screen and the previous open's
   * verdict still stands. The synthetic pointermove fired by the window
   * appearing lands in that gap, and must not be mistaken for movement --
   * which is why the pointer's last position outlives arm().
   */
  it('ignores the synthetic move when it arrives before the gate is armed', () => {
    const { moved, arm, handlePointerMove } = usePointerMoved();

    // A first open, during which the mouse is genuinely used.
    arm();
    handlePointerMove(at(400, 300));
    handlePointerMove(at(500, 400));
    expect(moved.value).toBe(true);

    // The window is shown again under the still-stationary pointer, and the
    // synthetic event beats the "opened" message to the renderer.
    handlePointerMove(at(500, 400));
    expect(moved.value).toBe(true); // stale verdict, not yet re-armed

    arm();
    expect(moved.value).toBe(false);

    // Another synthetic report from the same place must not reopen it.
    handlePointerMove(at(500, 400));
    expect(moved.value).toBe(false);
  });

  /*
   * The pointer keeps being tracked while the gate is open, so a reopen already
   * knows where it is instead of spending an event rediscovering it.
   *
   * This is the difference that closes the race: were the position forgotten on
   * arm(), the stationary report below would be the first of its open and be
   * taken as a mere reading -- leaving the *next* one, still stationary, to be
   * compared against it. Here it is recognised as stationary immediately, and
   * one real move is enough to open the gate straight after.
   */
  it('knows where the pointer is as soon as it is re-armed', () => {
    const { moved, arm, handlePointerMove } = usePointerMoved();

    arm();
    handlePointerMove(at(400, 300));
    handlePointerMove(at(500, 400));
    expect(moved.value).toBe(true);

    // A move made while the gate was open is still recorded.
    handlePointerMove(at(900, 700));
    arm();

    // So the very next real move opens the gate, with no reading spent first.
    handlePointerMove(at(901, 700));
    expect(moved.value).toBe(true);
  });

  // The position is tracked as "recorded or not", never as "is it truthy" --
  // a pointer at the screen origin is a real place like any other.
  it('treats the screen origin as a real position', () => {
    const { moved, arm, handlePointerMove } = usePointerMoved();

    arm();
    handlePointerMove(at(0, 0));
    expect(moved.value).toBe(false);

    handlePointerMove(at(0, 1));
    expect(moved.value).toBe(true);
  });

  it('can be armed repeatedly without opening the gate', () => {
    const { moved, arm, handlePointerMove } = usePointerMoved();

    arm();
    arm();
    handlePointerMove(at(400, 300));

    expect(moved.value).toBe(false);
  });
});
