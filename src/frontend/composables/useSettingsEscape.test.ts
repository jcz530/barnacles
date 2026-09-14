import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/*
 * The composable is exercised through the listener it registers, with the
 * router and search state stubbed. What is worth pinning here is the decision
 * it makes for a given keystroke -- clear, navigate, or stand aside -- not
 * VueUse's ability to attach an event listener.
 */
const push = vi.fn();
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }));

const returnPath = { value: '/' };
vi.mock('@/composables/useSettingsReturn', () => ({
  useSettingsReturn: () => ({ returnPath }),
}));

const searchState = { value: '' };
const clear = vi.fn(() => {
  searchState.value = '';
});
vi.mock('@/composables/useSettingsSearch', () => ({
  useSettingsSearch: () => ({ query: searchState, clear }),
}));

let handler: ((event: EscapeKeyEvent) => void) | null = null;
vi.mock('@vueuse/core', () => ({
  useEventListener: (_target: unknown, _event: string, fn: (e: EscapeKeyEvent) => void) => {
    handler = fn;
    return () => {};
  },
}));

import { useSettingsEscape, type EscapeKeyEvent } from './useSettingsEscape';

/** Minimal stand-in for the parts of a keydown the handler reads. */
function keyEvent(key: string, opts: { repeat?: boolean } = {}): EscapeKeyEvent {
  return {
    key,
    repeat: opts.repeat ?? false,
    preventDefault: vi.fn(),
  };
}

/**
 * Steers the "is a layer open?" check.
 *
 * `document` is assigned onto globalThis rather than spied on: these tests run
 * in vitest's `node` environment (see vitest.config.ts), where there is no DOM
 * and so nothing to spy on.
 */
let layerOpen = false;
const querySelector = vi.fn(() => (layerOpen ? {} : null));
(globalThis as { document?: unknown }).document = { querySelector };
// The composable names `window` when registering its listener; useEventListener
// is mocked, so this only needs to exist, not behave.
(globalThis as { window?: unknown }).window = {};

function setOpenLayer(isOpen: boolean) {
  layerOpen = isOpen;
}

describe('useSettingsEscape', () => {
  beforeEach(() => {
    push.mockClear();
    clear.mockClear();
    searchState.value = '';
    setOpenLayer(false);
    useSettingsEscape();
  });

  afterEach(() => {
    handler = null;
  });

  it('leaves settings when Escape is pressed with no search active', () => {
    handler?.(keyEvent('Escape'));

    expect(push).toHaveBeenCalledWith('/');
    expect(clear).not.toHaveBeenCalled();
  });

  it('returns to the page settings was opened from', () => {
    returnPath.value = '/ports';

    handler?.(keyEvent('Escape'));

    expect(push).toHaveBeenCalledWith('/ports');
    returnPath.value = '/';
  });

  it('clears the search first, without leaving the page', () => {
    searchState.value = 'tray';

    handler?.(keyEvent('Escape'));

    expect(clear).toHaveBeenCalled();
    // A filtered page should not vanish in a single press.
    expect(push).not.toHaveBeenCalled();
  });

  it('leaves settings on the press after the search is cleared', () => {
    searchState.value = 'tray';
    handler?.(keyEvent('Escape'));
    handler?.(keyEvent('Escape'));

    expect(push).toHaveBeenCalledWith('/');
  });

  it('stands aside while a dropdown or dialog is open', () => {
    setOpenLayer(true);

    handler?.(keyEvent('Escape'));

    // The layer closes itself; leaving as well would dismiss both at once.
    expect(push).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
  });

  it('still clears the search once the layer has closed', () => {
    setOpenLayer(true);
    searchState.value = 'tray';
    handler?.(keyEvent('Escape'));
    expect(clear).not.toHaveBeenCalled();

    setOpenLayer(false);
    handler?.(keyEvent('Escape'));
    expect(clear).toHaveBeenCalled();
  });

  it('ignores every other key', () => {
    handler?.(keyEvent('Enter'));
    handler?.(keyEvent('a'));
    handler?.(keyEvent('ArrowDown'));

    expect(push).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
  });

  it('treats a held key as one step back, not many', () => {
    handler?.(keyEvent('Escape', { repeat: true }));

    expect(push).not.toHaveBeenCalled();
  });
});
