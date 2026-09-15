import { useEventListener } from '@vueuse/core';
import { useRouter } from 'vue-router';
import { useSettingsSearch } from '@/composables/useSettingsSearch';
import { useSettingsReturn } from '@/composables/useSettingsReturn';

/**
 * The parts of a keydown this reads, structurally rather than as
 * `KeyboardEvent`.
 *
 * The test suite imports this module and runs in vitest's `node` environment,
 * where `tsconfig.test.json` sets `"lib": ["ESNext"]` and the DOM globals do
 * not exist -- naming `KeyboardEvent` here would fail type-check:test. A real
 * event satisfies this shape. `usePointerMoved` and `useScrollSpy` do the same.
 */
export interface EscapeKeyEvent {
  key: string;
  repeat: boolean;
  preventDefault: () => void;
}

/** The sliver of `document` this needs, for the same reason. */
interface LayerQuery {
  querySelector: (selectors: string) => unknown;
}
declare const document: LayerQuery;

/**
 * Selectors for a layer sitting over the page -- a dropdown, dialog, select or
 * popover. Each closes on Escape itself, and navigating away as well would
 * dismiss the layer and leave the page in a single press.
 *
 * Matched on the layer's role rather than `[data-state="open"]` alone: reka-ui
 * marks the *trigger* as open too, so the bare attribute is true even when
 * nothing is layered over the page.
 */
const OPEN_LAYER = [
  '[role="menu"][data-state="open"]',
  '[role="dialog"][data-state="open"]',
  '[role="alertdialog"][data-state="open"]',
  '[role="listbox"][data-state="open"]',
  '[data-radix-popper-content-wrapper]',
].join(', ');

/**
 * Escape backs out of settings, from anywhere on the page.
 *
 * Bound at the window rather than on the sidebar: settings is a mode you leave,
 * and the key that leaves it should not depend on which pane happens to hold
 * focus. A handler on the rail only fired while focus was inside the rail, so
 * Escape did nothing once you clicked into the settings themselves.
 *
 * It backs out one level at a time -- first it undoes the search, then it
 * leaves settings -- so a filtered page does not vanish in a single press.
 */
export function useSettingsEscape() {
  const router = useRouter();
  const { query, clear } = useSettingsSearch();
  const { returnPath } = useSettingsReturn();

  useEventListener(window, 'keydown', (event: EscapeKeyEvent) => {
    if (event.key !== 'Escape') return;
    // Holding the key repeats it; one press is one step back.
    if (event.repeat) return;

    // Anything layered over the page owns Escape first.
    if (document.querySelector(OPEN_LAYER)) return;

    event.preventDefault();

    if (query.value !== '') {
      clear();
      return;
    }

    void router.push(returnPath.value);
  });
}
