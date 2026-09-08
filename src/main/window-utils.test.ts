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

/** The floating palette: always-on-top and non-resizable, so not a main window. */
const paletteWindow = { ...mainWindow, isAlwaysOnTop: () => true, isResizable: () => false };

/** Run a block with process.platform forced, since the branches differ by OS. */
const withPlatform = async (platform: string, run: () => Promise<void>) => {
  const original = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
  try {
    await run();
  } finally {
    if (original) Object.defineProperty(process, 'platform', original);
  }
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

  it('treats a real window taking focus as the app being active', async () => {
    const { isApplicationActive } = await load();

    // Needed because the utility-window flag is cleared on a timer: clicking
    // into a window inside that gap is swallowed by the did-become-active
    // guard, and without this the flag stayed false and the hotkey floated the
    // palette over the window the user was looking at.
    emit('browser-window-focus', {}, mainWindow);

    expect(isApplicationActive()).toBe(true);
  });

  it('becomes active only when macOS says the app activated', async () => {
    const { isApplicationActive } = await load();

    emit('did-become-active');

    expect(isApplicationActive()).toBe(true);
  });

  it('ignores the activation that showing a utility window causes', async () => {
    const { isApplicationActive, setShowingUtilityWindow } = await load();

    // Showing the floating palette can activate the app as a side effect of it
    // taking keyboard focus. Counting that made dismissing the palette look
    // like Barnacles was already frontmost, so it stayed there instead of
    // returning focus to the app underneath.
    setShowingUtilityWindow(true);
    emit('did-become-active');

    expect(isApplicationActive()).toBe(false);
  });

  it('still activates normally once no utility window is showing', async () => {
    const { isApplicationActive, setShowingUtilityWindow } = await load();

    setShowingUtilityWindow(true);
    emit('did-become-active');
    setShowingUtilityWindow(false);
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

    // The palette is an NSPanel, so showing it takes keyboard focus without
    // activating the app; nothing about it should flip this flag.
    emit('browser-window-focus', {}, { ...mainWindow, isAlwaysOnTop: () => true });

    expect(isApplicationActive()).toBe(false);
  });
});

/**
 * did-become-active/did-resign-active are macOS-only, so elsewhere the flag is
 * driven by window focus. These run with the platform forced, since otherwise
 * the branch is unreachable on a macOS dev machine and went untested.
 */
describe('trackApplicationActivation on other platforms', () => {
  beforeEach(() => {
    listeners.clear();
    focusedWindow = null;
    vi.resetModules();
  });

  const loadFor = async (platform: string) => {
    let module!: typeof import('./window-utils');
    await withPlatform(platform, async () => {
      module = await import('./window-utils');
      module.trackApplicationActivation();
    });
    return module;
  };

  it('becomes active when a main window takes focus', async () => {
    const { isApplicationActive } = await loadFor('win32');

    emit('browser-window-focus', {}, mainWindow);

    expect(isApplicationActive()).toBe(true);
  });

  it('does not become active when only the palette has focus', async () => {
    const { isApplicationActive } = await loadFor('win32');

    emit('browser-window-focus', {}, paletteWindow);

    expect(isApplicationActive()).toBe(false);
  });

  it('goes inactive once no main window holds focus', async () => {
    const { isApplicationActive } = await loadFor('linux');

    emit('browser-window-focus', {}, mainWindow);
    focusedWindow = null;
    emit('browser-window-blur');
    await new Promise(resolve => setImmediate(resolve));

    expect(isApplicationActive()).toBe(false);
  });

  it('stays active while focus moves between our own main windows', async () => {
    const { isApplicationActive } = await loadFor('win32');

    emit('browser-window-focus', {}, mainWindow);
    // Blur fires as focus moves to the next window, which is still ours.
    focusedWindow = mainWindow;
    emit('browser-window-blur');
    await new Promise(resolve => setImmediate(resolve));

    expect(isApplicationActive()).toBe(true);
  });

  it('does not treat the palette taking focus as the app being active', async () => {
    const { isApplicationActive } = await loadFor('win32');

    // The exact hole this branch had: the palette holding focus after a blur
    // left the flag true, so the next hotkey press opened the in-app modal
    // over whatever the user was working in.
    emit('browser-window-focus', {}, mainWindow);
    focusedWindow = paletteWindow;
    emit('browser-window-blur');
    await new Promise(resolve => setImmediate(resolve));

    expect(isApplicationActive()).toBe(false);
  });
});
