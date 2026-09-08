import { BrowserWindow } from 'electron';

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
