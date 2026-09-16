/**
 * Keep a modal from dismissing when the click landed on a toast.
 *
 * Toasts render outside the dialog's DOM subtree, so reka's DismissableLayer
 * counts a pointerdown on one as a click outside and closes the dialog. Acting
 * on a toast raised *by* the dialog -- "Show in folder" on the share card's
 * "Image saved", say -- would tear down the dialog underneath it.
 *
 * Reka's own escape hatch for this is `DismissableLayerBranch`, which registers
 * a subtree as logically inside the layer, but that component is not part of
 * reka's public API. `preventDefault()` on the outside events is public and
 * supported, so that is what this uses.
 *
 * `focusOutside` matters as well as `pointerDownOutside`: tabbing to a toast
 * action would otherwise dismiss the dialog without any click at all.
 */

/** Sonner marks its toaster and each toast with these. */
const TOAST_SELECTOR = '[data-sonner-toaster], [data-sonner-toast]';

/*
 * Matched structurally rather than with `Element`, because the test project
 * compiles without the DOM lib (`tsconfig.test.json` pins `lib: ["ESNext"]` to
 * match vitest's `node` environment). Duck-typing is also the honest signature:
 * these are the only two members this module ever touches.
 */
interface SelectorMatchable {
  matches(selector: string): boolean;
  closest(selector: string): SelectorMatchable | null;
}

function isSelectorMatchable(node: unknown): node is SelectorMatchable {
  return (
    typeof node === 'object' &&
    node !== null &&
    typeof (node as SelectorMatchable).matches === 'function' &&
    typeof (node as SelectorMatchable).closest === 'function'
  );
}

/**
 * True when the event originated inside a toast.
 *
 * Reads `composedPath()` first so a click on something inside a shadow root
 * still resolves to the toast that hosts it; `event.target` is retargeted to
 * the shadow host in that case and `closest` from it can miss.
 */
export function isEventFromToast(event: Event): boolean {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];

  for (const node of path) {
    if (isSelectorMatchable(node) && node.matches(TOAST_SELECTOR)) return true;
  }

  const target: unknown = event.target;
  return isSelectorMatchable(target) && target.closest(TOAST_SELECTOR) !== null;
}

/**
 * Handler for reka's `pointerDownOutside` / `focusOutside` on a dialog.
 *
 * These carry the real DOM event on `detail.originalEvent`; preventing the
 * custom event is what stops reka emitting `dismiss`.
 */
export function useToastAwareDismiss() {
  function onInteractOutside(event: CustomEvent<{ originalEvent: Event }>): void {
    const originalEvent = event.detail?.originalEvent;
    if (originalEvent && isEventFromToast(originalEvent)) {
      event.preventDefault();
    }
  }

  return { onInteractOutside, isEventFromToast };
}
