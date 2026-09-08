import { app, BrowserWindow } from 'electron';

/**
 * How long the utility-window flag stays set after a popup or overlay is shown.
 * Long enough for macOS to deliver the `activate` event that showing a window
 * from an unfocused app triggers.
 */
export const ACTIVATE_EVENT_DELAY = 300;

// Set while a utility window (tray popup, command palette) is being shown, so
// the `activate` handler doesn't resurrect hidden main windows behind it.
let isShowingUtilityWindow = false;

/**
 * Flag that a utility window is being shown, suppressing the `activate` handler.
 */
export const setShowingUtilityWindow = (showing: boolean): void => {
  isShowingUtilityWindow = showing;
};

export const getShowingUtilityWindow = (): boolean => isShowingUtilityWindow;

/**
 * Clear the utility-window flag once the `activate` event it was guarding
 * against has had time to fire.
 */
export const resetUtilityWindowFlag = (): void => {
  setTimeout(() => setShowingUtilityWindow(false), ACTIVATE_EVENT_DELAY);
};

/**
 * Main windows are resizable and not always-on-top. Utility windows -- the tray
 * popup, the find overlay, the command palette -- fail one or both checks, which
 * is what keeps them out of window-focus, activation, and Window-menu logic.
 *
 * Any new utility window must be non-resizable or always-on-top (ideally both)
 * to stay excluded here.
 */
export const isMainWindow = (win: BrowserWindow): boolean =>
  !win.isDestroyed() && win.isResizable() && !win.isAlwaysOnTop();

/**
 * All real app windows, excluding utility windows.
 */
export const getMainWindows = (): BrowserWindow[] =>
  BrowserWindow.getAllWindows().filter(isMainWindow);

// Whether Barnacles is the frontmost application.
//
// BrowserWindow.getFocusedWindow() cannot answer this: it reports the window
// focused *within this application*, so it keeps returning a main window while
// you are typing in another app entirely. A global shortcut needs to know
// whether the app itself is in front, which only these app-level events track.
let isAppActive = false;

export const isApplicationActive = (): boolean => isAppActive;

/**
 * Start tracking whether the app is frontmost. Call once, after app ready.
 */
export const trackApplicationActivation = (): void => {
  // browser-window-focus is cross-platform and fires for the first window the
  // app opens, which covers the launch activation that did-become-active on its
  // own would miss (it does not fire for the state the app starts in).
  app.on('browser-window-focus', (_event, window) => {
    if (isMainWindow(window)) isAppActive = true;
  });

  if (process.platform === 'darwin') {
    // Fires on every activation, including via the App Switcher, and -- unlike
    // window focus -- resign tells us the app itself went to the background.
    app.on('did-become-active', () => {
      isAppActive = true;
    });
    app.on('did-resign-active', () => {
      isAppActive = false;
    });
    return;
  }

  // did-resign-active is macOS-only. Elsewhere, losing window focus is the
  // available signal that the app went to the background.
  app.on('browser-window-blur', () => {
    // Focus moving between our own windows blurs one and focuses the next, so
    // only treat this as leaving once nothing of ours holds focus.
    setImmediate(() => {
      isAppActive = BrowserWindow.getFocusedWindow() !== null;
    });
  });
};
