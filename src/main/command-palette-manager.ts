import { app, BrowserWindow, globalShortcut, screen } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { APP_CONFIG } from '../shared/constants';
import {
  getMainWindows,
  isApplicationActive,
  isMainWindow,
  resetUtilityWindowFlag,
  setShowingUtilityWindow,
} from './window-utils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PALETTE_WIDTH = 640;
/** Tall enough that the footer's action hints don't cost the list a row. */
const PALETTE_HEIGHT = 460;
/** Spotlight sits above centre; dead-centre reads as a modal rather than a launcher. */
const VERTICAL_POSITION = 0.22;

/**
 * How long after hiding the palette a hotkey press still counts as the press
 * that dismissed it.
 *
 * Pressing the shortcut while the palette has focus blurs it, and the blur
 * handler hides it before the shortcut callback runs. Without this window the
 * toggle would see an already-hidden palette and open something new -- which
 * looked like the hotkey summoning the app instead of closing the palette.
 */
const DISMISS_GRACE_MS = 250;

/** What a hotkey press should do, given the palette's current state. */
export type ToggleAction = 'hide' | 'ignore' | 'in-app' | 'show';

/**
 * Decide what a hotkey press means. Pure so the ordering rules below can be
 * tested without standing up real windows.
 */
export const decideToggleAction = (state: {
  paletteVisible: boolean;
  msSinceBlurHide: number;
  appActive: boolean;
  hasMainWindow: boolean;
}): ToggleAction => {
  if (state.paletteVisible) return 'hide';
  // The press that blurred the palette lands here, after the blur handler has
  // already hidden it. Swallow it rather than treating it as a fresh open.
  if (state.msSinceBlurHide < DISMISS_GRACE_MS) return 'ignore';
  if (state.appActive && state.hasMainWindow) return 'in-app';
  return 'show';
};

/**
 * What Escape means in the floating palette, given how deep its action stack is.
 *
 * The main process sees Escape before the renderer does, so it has to decide
 * whether to swallow the key and hide the window or let it through for the
 * renderer to back out one level. Pure so that decision can be tested.
 */
export const decideEscapeAction = (depth: number): 'hide' | 'forward' =>
  depth > 0 ? 'forward' : 'hide';

/**
 * What Ctrl+C means in the floating palette.
 *
 * It closes from any depth, unlike Escape which backs out a level at a time --
 * the gesture a developer's hands already make to mean "get me out of this".
 *
 * On Windows and Linux the same chord copies in a text field, so the decision
 * belongs to the renderer there: only it can see whether anything is selected.
 * macOS copies with Cmd+C, leaving Ctrl+C free to be acted on here.
 */
export const decideCtrlCAction = (platform: NodeJS.Platform): 'hide' | 'forward' =>
  platform === 'darwin' ? 'hide' : 'forward';

let paletteWindow: BrowserWindow | null = null;
/**
 * In-flight window creation.
 *
 * createPaletteWindow awaits loadURL, so a second hotkey press during that gap
 * would find paletteWindow still null and build another window. The orphans
 * stayed on screen while the tracked reference pointed at the newest one, so
 * every later press reported the palette as not visible and did nothing.
 */
let paletteWindowPromise: Promise<BrowserWindow> | null = null;

const ensurePaletteWindow = async (): Promise<BrowserWindow> => {
  if (paletteWindow && !paletteWindow.isDestroyed()) return paletteWindow;
  if (paletteWindowPromise) return paletteWindowPromise;

  paletteWindowPromise = createPaletteWindow()
    .then(win => {
      paletteWindow = win;
      return win;
    })
    .finally(() => {
      paletteWindowPromise = null;
    });

  return paletteWindowPromise;
};
/** When the palette was last hidden, for the dismiss grace window above. */
/**
 * How deep the palette's action stack is, as last reported by the renderer.
 *
 * Escape is intercepted here, before the renderer ever sees it, so this is the
 * only way to tell "back out of an item's actions" from "close the palette".
 *
 * Reported on every change rather than asked for on demand: the keystroke has
 * to be decided synchronously. The send happens on the same tick as the push
 * that caused it, and Escape needs a human keypress, so the window in which
 * this could be stale is not one a person can hit.
 */
let paletteDepth = 0;

export const setPaletteDepth = (depth: number): void => {
  paletteDepth = Math.max(0, depth);
};

let lastHiddenAt = 0;
let registeredAccelerator: string | null = null;
let lastRegistrationError: string | null = null;

const checkViteDevServer = async (): Promise<boolean> => {
  try {
    const response = await fetch(`http://localhost:${APP_CONFIG.VITE_DEV_SERVER_PORT}`);
    return response.ok;
  } catch {
    return false;
  }
};

/**
 * Centre the palette on whichever display the cursor is on.
 *
 * Cursor position rather than the focused window: the palette is opened from
 * other applications, so there may be no Barnacles window to anchor to.
 */
const positionOnActiveDisplay = (win: BrowserWindow): void => {
  const { workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const x = Math.round(workArea.x + (workArea.width - PALETTE_WIDTH) / 2);
  const y = Math.round(workArea.y + workArea.height * VERTICAL_POSITION);
  win.setPosition(x, y, false);
};

const createPaletteWindow = async (): Promise<BrowserWindow> => {
  const win = new BrowserWindow({
    width: PALETTE_WIDTH,
    height: PALETTE_HEIGHT,
    show: false,
    frame: false,
    // NSPanel semantics on macOS: a panel takes keyboard focus without
    // activating the application, so showing it cannot drag the app's other
    // windows forward. This is how Spotlight and Raycast-style launchers
    // behave, and it is the only option that stops the main window being
    // raised. Not in Electron's typings, but `type` is a plain string there
    // and the behaviour is supported (electron/electron#40307).
    ...(process.platform === 'darwin' ? { type: 'panel' } : {}),
    // Transparency is unreliable on some Linux compositors, where it renders
    // black rather than clear.
    transparent: process.platform === 'darwin',
    backgroundColor: process.platform === 'darwin' ? undefined : '#00000000',
    // Both of these keep the palette out of getMainWindows(), which is what
    // stops it appearing in the Window menu or being treated as an app window.
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    fullscreenable: false,
    movable: false,
    hasShadow: true,
    vibrancy: 'menu',
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // The window is hidden between uses, and Chromium throttles hidden
      // renderers to roughly a frame a second. That throttle is paid back on
      // show, as the lag between pressing the hotkey and seeing the palette.
      backgroundThrottling: false,
    },
  });

  // A plain always-on-top window will not draw over another app's full-screen
  // space, which is exactly where the global hotkey gets used.
  win.setAlwaysOnTop(true, 'floating');

  const isDevServer = !app.isPackaged && (await checkViteDevServer());
  if (isDevServer) {
    await win.loadURL(`http://localhost:${APP_CONFIG.VITE_DEV_SERVER_PORT}/command-palette`);
  } else {
    await win.loadFile(path.join(__dirname, '../renderer/index.html'), {
      hash: '/command-palette',
    });
  }

  // Auto-hide when focus moves elsewhere, the way a launcher should.
  win.on('blur', () => {
    setImmediate(() => {
      if (win.isDestroyed() || win.isFocused()) return;
      // Detached devtools steal focus; hiding then would make the palette
      // impossible to inspect.
      if (!app.isPackaged && win.webContents.isDevToolsOpened()) return;
      hideCommandPalette({ viaBlur: true });
    });
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;

    if (input.key === 'Escape') {
      // Inside an item's actions Escape means "go back", which only the
      // renderer can do -- so let it through rather than closing the window.
      if (decideEscapeAction(paletteDepth) === 'forward') return;

      event.preventDefault();
      hideCommandPalette();
      return;
    }

    // Ctrl+C closes from any depth, unlike Escape which backs out one level at
    // a time. Handled here as well as in the renderer because this window's
    // keys are seen here first.
    if (input.control && input.key.toLowerCase() === 'c') {
      if (decideCtrlCAction(process.platform) === 'forward') return;

      event.preventDefault();
      hideCommandPalette();
      return;
    }

    if (!app.isPackaged) {
      const isDevToolsShortcut =
        (input.key === 'I' &&
          ((input.meta && input.alt && process.platform === 'darwin') ||
            (input.control && input.shift && process.platform !== 'darwin'))) ||
        input.key === 'F12';

      if (isDevToolsShortcut) {
        event.preventDefault();
        if (win.webContents.isDevToolsOpened()) {
          win.webContents.closeDevTools();
        } else {
          win.webContents.openDevTools({ mode: 'detach' });
        }
      }
    }
  });

  win.on('closed', () => {
    paletteWindow = null;
  });

  // The window is kept alive for the life of the app, so a dead renderer would
  // otherwise be handed back on every future press -- showing an empty frame
  // with no way to recover short of restarting. Drop it and let the next press
  // build a fresh one.
  win.webContents.on('render-process-gone', () => {
    if (!win.isDestroyed()) win.destroy();
    paletteWindow = null;
  });

  return win;
};

/**
 * Show the floating palette, creating it on first use.
 *
 * The window is kept alive and hidden between invocations so the hotkey feels
 * instant rather than paying a renderer boot each time.
 */
const showCommandPalette = async (): Promise<void> => {
  setShowingUtilityWindow(true);

  // Taken synchronously when the window already exists. Awaiting unconditionally
  // costs an event-loop hop, and on a busy main process that measured as
  // 100-280ms of dead time between the keypress and the window appearing.
  const cached = paletteWindow && !paletteWindow.isDestroyed() ? paletteWindow : null;
  const win = cached ?? (await ensurePaletteWindow());

  // Scoped to the time the palette is up: leaving it on makes the app's other
  // windows follow it onto whatever space you are working in.
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  positionOnActiveDisplay(win);
  // showInactive rather than show: belt and braces alongside the panel type
  // above, since show() is the call that activates an app and drags its other
  // windows forward with it.
  win.showInactive();
  win.focus();

  // The renderer outlives a single open, so its cached data would otherwise go
  // stale; it refetches, clears the query, and refocuses the input on this.
  // On the very first open the renderer may still be loading, in which case
  // nothing is listening yet -- wait for it rather than dropping the message.
  const notifyOpened = () => {
    if (!win.isDestroyed()) win.webContents.send('command-palette:opened');
  };
  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', notifyOpened);
  } else {
    notifyOpened();
  }
};

export const hideCommandPalette = (options?: { viaBlur?: boolean }): void => {
  // Whatever level it was on is gone; a stale depth would leave Escape unable
  // to close the window on the next open.
  paletteDepth = 0;

  if (paletteWindow && !paletteWindow.isDestroyed() && paletteWindow.isVisible()) {
    // Only a blur-driven hide arms the grace window below. Escape, or running a
    // command, is an explicit dismissal and must leave the next press free to
    // reopen immediately.
    lastHiddenAt = options?.viaBlur ? Date.now() : 0;
    paletteWindow.hide();
    paletteWindow.setVisibleOnAllWorkspaces(false);
    resetUtilityWindowFlag();
  }
};

/**
 * Toggle the palette, preferring the in-app one when the app is already in front.
 *
 * A global shortcut fires even when Barnacles is focused, and popping a separate
 * always-on-top window over the window you are already looking at reads as a
 * bug. This also covers the case where someone binds the same combo the in-app
 * palette uses: the OS grab swallows it before the renderer sees it, so without
 * this branch Cmd+K would open the floating window while the app is focused.
 */
export const toggleCommandPalette = async (): Promise<void> => {
  if (isQuitting) return;

  // A press landing while the window is still being built would otherwise find
  // paletteWindow null, fall through, and start building a second one. Ignore
  // it: the palette is already on its way to the screen.
  if (paletteWindowPromise) return;

  const visible = Boolean(
    paletteWindow && !paletteWindow.isDestroyed() && paletteWindow.isVisible()
  );
  const focused = BrowserWindow.getFocusedWindow();
  const focusedIsMain = Boolean(focused && isMainWindow(focused));

  // Only the tracked flag can answer "is Barnacles the frontmost app?".
  // getFocusedWindow() keeps naming one of our windows while you are in another
  // app entirely -- verified: it reported a main window while Finder was in
  // front -- so it says which window would receive the message, never whether
  // the app is active.
  const appActive = isApplicationActive();
  const target = focusedIsMain ? focused : getMainWindows()[0];

  const action = decideToggleAction({
    paletteVisible: visible,
    msSinceBlurHide: Date.now() - lastHiddenAt,
    appActive,
    hasMainWindow: Boolean(target),
  });

  switch (action) {
    case 'hide':
      hideCommandPalette();
      return;
    case 'ignore':
      return;
    case 'in-app':
      if (target) {
        if (!target.isVisible()) target.show();
        target.webContents.send('command-palette:toggle');
      }
      return;
    case 'show':
      await showCommandPalette();
  }
};

/**
 * Set once shutdown starts. Quit is deferred while processes are cleaned up, and
 * the View menu item stays clickable in that window -- without this, a click
 * would build a fresh window during teardown.
 */
let isQuitting = false;

export const destroyCommandPalette = (): void => {
  isQuitting = true;
  if (paletteWindow && !paletteWindow.isDestroyed()) {
    paletteWindow.destroy();
  }
  paletteWindow = null;
};

export interface ShortcutRegistration {
  success: boolean;
  error?: string;
}

/**
 * Build the palette window ahead of the first press.
 *
 * Creating it lazily costs ~400ms on the first hotkey of a session, which is
 * exactly the moment the palette should feel instant. Building it at startup
 * moves that cost somewhere nobody is waiting.
 */
export const prewarmCommandPalette = async (): Promise<void> => {
  if (isQuitting) return;
  try {
    await ensurePaletteWindow();
  } catch (error) {
    // Non-fatal: the next press will simply build it the slow way.
    console.error('[CommandPalette] Prewarm failed:', error);
  }
};

export const unregisterPaletteShortcut = (): void => {
  // Only ever release our own binding -- unregisterAll() would clobber any
  // other shortcut the app registers later.
  if (registeredAccelerator && globalShortcut.isRegistered(registeredAccelerator)) {
    globalShortcut.unregister(registeredAccelerator);
  }
  registeredAccelerator = null;
};

/**
 * Bind the global hotkey.
 *
 * Two distinct failure modes: register() returns false when another
 * application already owns the combo, and throws when the accelerator string
 * itself is malformed.
 */
export const registerPaletteShortcut = (accelerator: string): ShortcutRegistration => {
  unregisterPaletteShortcut();

  if (!accelerator) {
    lastRegistrationError = 'No shortcut set';
    return { success: false, error: lastRegistrationError };
  }

  try {
    const registered = globalShortcut.register(accelerator, () => {
      void toggleCommandPalette();
    });

    if (!registered) {
      lastRegistrationError = `"${accelerator}" is already in use by another application.`;
      return { success: false, error: lastRegistrationError };
    }

    registeredAccelerator = accelerator;
    lastRegistrationError = null;
    return { success: true };
  } catch {
    lastRegistrationError = `"${accelerator}" is not a valid shortcut.`;
    return { success: false, error: lastRegistrationError };
  }
};

export const getShortcutStatus = (): {
  accelerator: string | null;
  registered: boolean;
  error: string | null;
} => ({
  accelerator: registeredAccelerator,
  registered: registeredAccelerator !== null,
  error: lastRegistrationError,
});
