import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { APP_CONFIG } from '../shared/constants';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const checkViteDevServer = async (): Promise<boolean> => {
  try {
    const response = await fetch(`http://localhost:${APP_CONFIG.VITE_DEV_SERVER_PORT}`);
    return response.ok;
  } catch {
    return false;
  }
};

// Constants
const OVERLAY_WIDTH = 420;
const OVERLAY_HEIGHT = 56;
const TOP_OFFSET = 64; // matches top-16 (4rem = 64px)
const RIGHT_OFFSET = 16; // matches right-4 (1rem = 16px)

// Track overlays per parent window
const overlays = new Map<number, BrowserWindow>();

/**
 * Calculates the overlay position relative to the parent window
 */
const calculateOverlayPosition = (parentWindow: BrowserWindow): { x: number; y: number } => {
  const [parentX, parentY] = parentWindow.getPosition();
  const [parentWidth] = parentWindow.getSize();

  const x = parentX + parentWidth - OVERLAY_WIDTH - RIGHT_OFFSET;
  const y = parentY + TOP_OFFSET;

  return { x, y };
};

/**
 * Creates or toggles the find overlay for a given parent window
 */
export const toggleFindOverlay = async (parentWindow: BrowserWindow): Promise<void> => {
  const parentId = parentWindow.id;
  const existing = overlays.get(parentId);

  if (existing && !existing.isDestroyed()) {
    if (existing.isVisible()) {
      closeFindOverlay(parentWindow);
      return;
    }
    // Reposition and show
    const pos = calculateOverlayPosition(parentWindow);
    existing.setPosition(pos.x, pos.y, false);
    existing.show();
    existing.focus();
    return;
  }

  // Create new overlay window
  const { x, y } = calculateOverlayPosition(parentWindow);

  const overlay = new BrowserWindow({
    width: OVERLAY_WIDTH,
    height: OVERLAY_HEIGHT,
    x,
    y,
    parent: parentWindow,
    show: false,
    frame: false,
    resizable: false,
    transparent: true,
    skipTaskbar: true,
    fullscreenable: false,
    hasShadow: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlays.set(parentId, overlay);

  // Load the find-overlay route
  const isDevServer = !app.isPackaged && (await checkViteDevServer());
  if (isDevServer) {
    overlay.loadURL(`http://localhost:${APP_CONFIG.VITE_DEV_SERVER_PORT}/find-overlay`);
  } else {
    overlay.loadFile(path.join(__dirname, '../renderer/index.html'), {
      hash: '/find-overlay',
    });
  }

  // Reposition overlay when parent moves or resizes
  const reposition = () => {
    if (overlay.isDestroyed() || !overlay.isVisible()) return;
    const pos = calculateOverlayPosition(parentWindow);
    overlay.setPosition(pos.x, pos.y, false);
  };

  parentWindow.on('move', reposition);
  parentWindow.on('resize', reposition);

  // Clean up overlay when parent closes
  parentWindow.once('closed', () => {
    if (!overlay.isDestroyed()) {
      overlay.destroy();
    }
    overlays.delete(parentId);
  });

  // Handle Cmd+F / Ctrl+F in overlay window to toggle it closed
  overlay.webContents.on('before-input-event', (event, input) => {
    const isFindShortcut =
      input.key === 'f' &&
      input.type === 'keyDown' &&
      ((input.meta && process.platform === 'darwin') ||
        (input.control && process.platform !== 'darwin'));

    if (isFindShortcut) {
      event.preventDefault();
      closeFindOverlay(parentWindow);
    }

    // Dev tools shortcut
    if (process.env.NODE_ENV === 'development') {
      const isDevToolsShortcut =
        (input.key === 'I' &&
          ((input.meta && input.alt && process.platform === 'darwin') ||
            (input.control && input.shift && process.platform !== 'darwin'))) ||
        input.key === 'F12';

      if (isDevToolsShortcut) {
        event.preventDefault();
        if (!overlay.isDestroyed()) {
          if (overlay.webContents.isDevToolsOpened()) {
            overlay.webContents.closeDevTools();
          } else {
            overlay.webContents.openDevTools({ mode: 'detach' });
          }
        }
      }
    }
  });

  // Show when ready
  overlay.once('ready-to-show', () => {
    overlay.show();
    overlay.focus();
  });

  // Clean up map entry when overlay is destroyed
  overlay.once('closed', () => {
    overlays.delete(parentId);
  });
};

/**
 * Closes the find overlay for a given parent window
 */
export const closeFindOverlay = (parentWindow: BrowserWindow): void => {
  const overlay = overlays.get(parentWindow.id);
  if (overlay && !overlay.isDestroyed()) {
    overlay.hide();
  }
  // Stop find highlights on parent
  parentWindow.webContents.stopFindInPage('clearSelection');
  parentWindow.focus();
};

/**
 * Gets the overlay window for a given parent window
 */
export const getFindOverlay = (parentId: number): BrowserWindow | undefined => {
  const overlay = overlays.get(parentId);
  if (overlay && !overlay.isDestroyed()) {
    return overlay;
  }
  return undefined;
};
