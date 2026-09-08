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
const PALETTE_HEIGHT = 420;
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

let paletteWindow: BrowserWindow | null = null;
/** When the palette was last hidden, for the dismiss grace window above. */
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
    },
  });

  // A plain always-on-top window will not draw over another app's full-screen
  // space, which is exactly where the global hotkey gets used.
  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

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

  if (!paletteWindow || paletteWindow.isDestroyed()) {
    paletteWindow = await createPaletteWindow();
  }

  positionOnActiveDisplay(paletteWindow);
  paletteWindow.show();
  // Without this the window is visible but not key, so the renderer cannot take
  // keyboard focus and the caret never lands in the search box.
  paletteWindow.focus();

  // The renderer outlives a single open, so its cached data would otherwise go
  // stale; it refetches, clears the query, and refocuses the input on this.
  // On the very first open the renderer may still be loading, in which case
  // nothing is listening yet -- wait for it rather than dropping the message.
  const notifyOpened = () => paletteWindow?.webContents.send('command-palette:opened');
  if (paletteWindow.webContents.isLoading()) {
    paletteWindow.webContents.once('did-finish-load', notifyOpened);
  } else {
    notifyOpened();
  }
};

export const hideCommandPalette = (options?: { viaBlur?: boolean }): void => {
  if (paletteWindow && !paletteWindow.isDestroyed() && paletteWindow.isVisible()) {
    // Only a blur-driven hide arms the grace window below. Escape, or running a
    // command, is an explicit dismissal and must leave the next press free to
    // reopen immediately.
    lastHiddenAt = options?.viaBlur ? Date.now() : 0;
    paletteWindow.hide();
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
  const visible = Boolean(
    paletteWindow && !paletteWindow.isDestroyed() && paletteWindow.isVisible()
  );
  // getFocusedWindow() reports the window focused *within this application* and
  // keeps naming one while you are in another app, so app activation -- not
  // window focus -- is what decides between the two palettes.
  const focused = BrowserWindow.getFocusedWindow();
  const target = focused && isMainWindow(focused) ? focused : getMainWindows()[0];

  const action = decideToggleAction({
    paletteVisible: visible,
    msSinceBlurHide: Date.now() - lastHiddenAt,
    appActive: isApplicationActive(),
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

export const destroyCommandPalette = (): void => {
  if (paletteWindow && !paletteWindow.isDestroyed()) {
    paletteWindow.destroy();
  }
  paletteWindow = null;
};

export interface ShortcutRegistration {
  success: boolean;
  error?: string;
}

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
