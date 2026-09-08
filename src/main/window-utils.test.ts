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

  it('becomes active when a main window takes focus', async () => {
    const { isApplicationActive } = await load();

    emit('browser-window-focus', {}, mainWindow);

    expect(isApplicationActive()).toBe(true);
  });

  it('goes inactive when the app resigns to another application', async () => {
    const { isApplicationActive } = await load();

    emit('browser-window-focus', {}, mainWindow);
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

  it('ignores focus from utility windows', async () => {
    const { isApplicationActive } = await load();

    // The floating palette is always-on-top, so it is not evidence the app
    // itself is frontmost.
    emit('browser-window-focus', {}, { ...mainWindow, isAlwaysOnTop: () => true });

    expect(isApplicationActive()).toBe(false);
  });
});
