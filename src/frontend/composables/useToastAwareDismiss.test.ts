import { describe, it, expect } from 'vitest';
import { isEventFromToast, useToastAwareDismiss } from '@/composables/useToastAwareDismiss';

/*
 * Vitest runs `environment: 'node'`, so there is no DOM here. The composable
 * duck-types on `matches`/`closest` rather than `instanceof Element`, so these
 * stand-ins are all it needs -- no global patching required.
 */
class FakeElement {
  constructor(
    private readonly selectors: string[] = [],
    private readonly ancestor: FakeElement | null = null
  ) {}

  matches(selector: string): boolean {
    return selector.split(',').some(s => this.selectors.includes(s.trim()));
  }

  closest(selector: string): FakeElement | null {
    if (this.matches(selector)) return this;
    return this.ancestor?.closest(selector) ?? null;
  }
}

/** An event whose composedPath() is empty, as a non-shadow-DOM event's may be. */
function plainEvent(target: unknown): Event {
  return { target, composedPath: () => [] } as unknown as Event;
}

/** An event that only reveals its true origin through composedPath(). */
function shadowEvent(target: unknown, path: unknown[]): Event {
  return { target, composedPath: () => path } as unknown as Event;
}

const toast = () => new FakeElement(['[data-sonner-toast]']);
const toaster = () => new FakeElement(['[data-sonner-toaster]']);
const plain = () => new FakeElement([]);

describe('isEventFromToast', () => {
  it('detects a click on the toast itself', () => {
    expect(isEventFromToast(plainEvent(toast()))).toBe(true);
  });

  it('detects a click on the toaster viewport', () => {
    expect(isEventFromToast(plainEvent(toaster()))).toBe(true);
  });

  it('detects a click on a button inside a toast', () => {
    const button = new FakeElement([], toast());
    expect(isEventFromToast(plainEvent(button))).toBe(true);
  });

  it('ignores a click on the dialog behind the toast', () => {
    const dialogButton = new FakeElement([], plain());
    expect(isEventFromToast(plainEvent(dialogButton))).toBe(false);
  });

  it('uses composedPath so a retargeted shadow-DOM event still resolves', () => {
    // `target` is the shadow host and knows nothing about the toast; only the
    // composed path reveals that the click began inside one.
    expect(isEventFromToast(shadowEvent(plain(), [plain(), toast()]))).toBe(true);
  });

  it('does not throw when composedPath is unavailable', () => {
    const event = { target: toast() } as unknown as Event;
    expect(isEventFromToast(event)).toBe(true);
  });

  it('returns false for an event with no target', () => {
    expect(isEventFromToast(plainEvent(null))).toBe(false);
  });

  /*
   * A real composedPath() ends with the document and the window, and can carry
   * text nodes. None of them are elements, and `document` in particular has a
   * `querySelector` that makes it look element-ish -- so the guard has to reject
   * anything missing the `matches`/`closest` pair rather than duck out early.
   */
  it('ignores non-element nodes in the composed path', () => {
    const textNode = { nodeType: 3, data: 'Image saved' };
    const documentLike = { querySelector: () => null, nodeType: 9 };
    const windowLike = { self: null };

    const event = shadowEvent(null, [textNode, documentLike, windowLike]);

    expect(isEventFromToast(event)).toBe(false);
  });

  it('still finds the toast when the path also carries non-elements', () => {
    const textNode = { nodeType: 3, data: 'Show in folder' };
    const documentLike = { querySelector: () => null, nodeType: 9 };

    const event = shadowEvent(null, [textNode, toast(), documentLike]);

    expect(isEventFromToast(event)).toBe(true);
  });

  it('does not treat a half-matching object as an element', () => {
    // `matches` but no `closest`: not an Element, must not be trusted.
    const halfElement = { matches: () => true };

    expect(isEventFromToast(shadowEvent(halfElement, [halfElement]))).toBe(false);
  });
});

describe('useToastAwareDismiss', () => {
  /** Mirrors reka's outside events: the real DOM event rides on detail. */
  function outsideEvent(originalEvent: Event | undefined) {
    let prevented = false;
    const event = {
      detail: originalEvent ? { originalEvent } : undefined,
      preventDefault: () => {
        prevented = true;
      },
    } as unknown as CustomEvent<{ originalEvent: Event }>;
    return { event, wasPrevented: () => prevented };
  }

  it('prevents dismissal when the interaction came from a toast', () => {
    const { onInteractOutside } = useToastAwareDismiss();
    const { event, wasPrevented } = outsideEvent(plainEvent(toast()));

    onInteractOutside(event);

    expect(wasPrevented()).toBe(true);
  });

  it('lets a genuine outside click dismiss the dialog', () => {
    const { onInteractOutside } = useToastAwareDismiss();
    const { event, wasPrevented } = outsideEvent(plainEvent(plain()));

    onInteractOutside(event);

    expect(wasPrevented()).toBe(false);
  });

  it('lets dismissal proceed when there is no original event', () => {
    const { onInteractOutside } = useToastAwareDismiss();
    const { event, wasPrevented } = outsideEvent(undefined);

    onInteractOutside(event);

    expect(wasPrevented()).toBe(false);
  });
});
