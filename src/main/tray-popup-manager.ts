import { BrowserWindow, screen } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { setShowingTrayPopup } from './main';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const POPUP_WIDTH = 380;
const POPUP_HEIGHT = 500;
const EDGE_PADDING = 8;
const TRAY_OFFSET = 4;
const ACTIVATE_EVENT_DELAY = 300; // Delay before resetting flag to prevent activate event

let popupWindow: BrowserWindow | null = null;

/**
 * Helper function to reset the activate event flag after a delay
 */
const resetActivateFlag = (): void => {
  setTimeout(() => setShowingTrayPopup(false), ACTIVATE_EVENT_DELAY);
};

/**
 * Calculates the optimal position for the tray popup window
 */
const calculatePopupPosition = (trayBounds: Electron.Rectangle): { x: number; y: number } => {
  // Get the display where the tray icon is located
  // Use the center point of the tray icon for better accuracy
  const trayCenter = {
    x: Math.round(trayBounds.x + trayBounds.width / 2),
    y: Math.round(trayBounds.y + trayBounds.height / 2),
  };
  const trayDisplay = screen.getDisplayNearestPoint(trayCenter);
  const { x: displayX, y: displayY, width: displayWidth, height: displayHeight } = trayDisplay.workArea;

  // Position window near tray icon (centered horizontally on the tray icon)
  let x = Math.round(trayBounds.x + trayBounds.width / 2 - POPUP_WIDTH / 2);
  let y = Math.round(trayBounds.y + trayBounds.height + TRAY_OFFSET);

  // Keep window within the display bounds
  const displayRight = displayX + displayWidth;
  const displayBottom = displayY + displayHeight;

  // Adjust horizontal position to stay within display
  if (x + POPUP_WIDTH > displayRight) {
    x = displayRight - POPUP_WIDTH - EDGE_PADDING;
  }
  if (x < displayX + EDGE_PADDING) {
    x = displayX + EDGE_PADDING;
  }

  // For macOS menu bar, window should appear below the icon
  // For Windows/Linux system tray (bottom), it should appear above if not enough space below
  if (process.platform === 'win32' || process.platform === 'linux') {
    if (y + POPUP_HEIGHT > displayBottom) {
      y = trayBounds.y - POPUP_HEIGHT - TRAY_OFFSET;
    }
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[Tray] Position calculation:', {
      trayBounds,
      trayCenter,
      display: { x: displayX, y: displayY, width: displayWidth, height: displayHeight },
      finalPosition: { x, y },
    });
  }

  return { x, y };
};

/**
 * Creates or toggles the tray popup window
 */
export const createTrayPopup = (trayBounds: Electron.Rectangle): BrowserWindow => {
  if (process.env.NODE_ENV === 'development') {
    console.log('[Tray] createTrayPopup called with bounds:', trayBounds);
  }

  // Set flag to prevent activate event from showing main window
  setShowingTrayPopup(true);

  // If window exists, toggle its visibility
  if (popupWindow && !popupWindow.isDestroyed()) {
    if (popupWindow.isVisible()) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Tray] Hiding existing visible popup');
      }
      popupWindow.hide();
      resetActivateFlag();
      return popupWindow;
    } else {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Tray] Repositioning and showing existing hidden popup');
      }
      // Reposition the window before showing it (for multi-monitor support)
      const position = calculatePopupPosition(trayBounds);
      popupWindow.setPosition(position.x, position.y, false);
      popupWindow.show();
      popupWindow.focus();
      // Flag will be reset when window is hidden
      return popupWindow;
    }
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[Tray] Creating new popup window');
  }

  // Calculate the optimal position for the popup
  const { x, y } = calculatePopupPosition(trayBounds);

  popupWindow = new BrowserWindow({
    width: POPUP_WIDTH,
    height: POPUP_HEIGHT,
    x,
    y,
    show: false,
    frame: false,
    resizable: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    hasShadow: true,
    vibrancy: 'menu', // macOS vibrancy effect that blurs content behind the window
    visualEffectState: 'active',
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Determine the URL to load
  const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

  if (VITE_DEV_SERVER_URL) {
    // Development mode
    popupWindow.loadURL(`${VITE_DEV_SERVER_URL}#/tray-popup`);
  } else {
    // Production mode
    popupWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
      hash: '/tray-popup',
    });
  }

  // Ensure window is focused when shown to enable blur events
  popupWindow.on('show', () => {
    if (popupWindow && !popupWindow.isDestroyed()) {
      popupWindow.focus();
    }
  });

  // Hide window when it loses focus (auto-hide behavior)
  popupWindow.on('blur', () => {
    // Use setImmediate for better performance than setTimeout
    setImmediate(() => {
      if (popupWindow && !popupWindow.isDestroyed() && !popupWindow.isFocused()) {
        popupWindow.hide();
        resetActivateFlag();
      }
    });
  });

  // Show window when ready
  popupWindow.once('ready-to-show', () => {
    popupWindow?.show();
  });

  // Open dev tools in development
  if (!process.env.VITE_DEV_SERVER_URL && process.argv.includes('--dev')) {
    popupWindow.webContents.openDevTools({ mode: 'detach' });
  }

  return popupWindow;
};

/**
 * Hides the tray popup window
 */
export const hideTrayPopup = (): void => {
  if (popupWindow && !popupWindow.isDestroyed() && popupWindow.isVisible()) {
    popupWindow.hide();
  }
};

/**
 * Destroys the tray popup window
 */
export const destroyTrayPopup = (): void => {
  if (popupWindow && !popupWindow.isDestroyed()) {
    popupWindow.destroy();
    popupWindow = null;
    // Reset the flag to prevent any stale state
    setShowingTrayPopup(false);
  }
};

/**
 * Gets the current popup window instance
 */
export const getTrayPopup = (): BrowserWindow | null => {
  return popupWindow;
};
