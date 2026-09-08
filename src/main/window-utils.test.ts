import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Electron app/BrowserWindow stand-ins. The point of these tests is the
 * bookkeeping in trackApplicationActivation, which is pure logic over events.
 */
const listeners = new Map<string, ((...args: unknown[]) => void)[]>();
let focusedWindow: unknown = null;

const emit = (event: string, ...args: unknown[]) => {
  for (const listener of listeners.get(event) ?? []) listener(...args);
};

vi.mock('electron', () => ({
  app: {
    on: (event: string, listener: (...args: unknown[]) => void) => {
      listeners.set(event, [...(listeners.get(event) ?? []), listener]);
    },
  },
  BrowserWindow: {
    getAllWindows: () => [],
    getFocusedWindow: () => focusedWindow,
  },
}));

const mainWindow = {
  isDestroyed: () => false,
  isResizable: () => true,
  isAlwaysOnTop: () => false,
};

describe('trackApplicationActivation', () => {
  beforeEach(() => {
    listeners.clear();
    focusedWindow = null;
    vi.resetModules();
  });

  const load = async () => {
    const module = await import('./window-utils');
    module.trackApplicationActivation();
    return module;
  };

  it('starts inactive until something says otherwise', async () => {
    const { isApplicationActive } = await load();
    expect(isApplicationActive()).toBe(false);
  });

  it('ignores window focus on macOS, which lies about activation', async () => {
    const { isApplicationActive } = await load();

    // Creating a window fires this even when the app never came to the front --
    // every dev restart while you work in another app. Trusting it left the flag
    // stuck true and sent the global hotkey to the in-app modal.
    emit('browser-window-focus', {}, mainWindow);

    expect(isApplicationActive()).toBe(false);
  });

  it('becomes active only when macOS says the app activated', async () => {
    const { isApplicationActive } = await load();

    emit('did-become-active');

    expect(isApplicationActive()).toBe(true);
  });

  it('goes inactive when the app resigns to another application', async () => {
    const { isApplicationActive } = await load();

    emit('did-become-active');
    // The signal that another app came to the front. Window focus alone never
    // reports this, which is why the palette used to open the in-app modal
    // while the user was in a different application.
    emit('did-resign-active');

    expect(isApplicationActive()).toBe(false);
  });

  it('comes back on app switcher activation', async () => {
    const { isApplicationActive } = await load();

    emit('did-resign-active');
    emit('did-become-active');

    expect(isApplicationActive()).toBe(true);
  });

  it('does not treat the floating palette as the app being frontmost', async () => {
    const { isApplicationActive } = await load();

    // The palette runs in accessory mode precisely so showing it does not
    // activate the app; nothing about it should flip this flag.
    emit('browser-window-focus', {}, { ...mainWindow, isAlwaysOnTop: () => true });

    expect(isApplicationActive()).toBe(false);
  });
});
