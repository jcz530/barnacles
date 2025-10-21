import { BrowserWindow, screen } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let popupWindow: BrowserWindow | null = null;

/**
 * Creates or toggles the tray popup window
 */
export const createTrayPopup = (trayBounds: Electron.Rectangle): BrowserWindow => {
  // If window exists and is visible, hide it
  if (popupWindow && !popupWindow.isDestroyed()) {
    if (popupWindow.isVisible()) {
      popupWindow.hide();
    } else {
      popupWindow.show();
      popupWindow.focus();
    }
    return popupWindow;
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  const windowWidth = 380;
  const windowHeight = 500;

  // Position window near tray icon
  let x = Math.round(trayBounds.x + trayBounds.width / 2 - windowWidth / 2);
  let y = Math.round(trayBounds.y + trayBounds.height + 4);

  // Keep window on screen
  if (x + windowWidth > width) {
    x = width - windowWidth - 8;
  }
  if (x < 8) {
    x = 8;
  }

  // For macOS menu bar, window should appear below the icon
  // For Windows/Linux system tray (bottom), it should appear above
  if (process.platform === 'win32' || process.platform === 'linux') {
    if (y + windowHeight > height) {
      y = trayBounds.y - windowHeight - 4;
    }
  }

  popupWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
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

  // Hide window when it loses focus (standard approach)
  popupWindow.on('blur', () => {
    // Use setImmediate for better performance than setTimeout
    setImmediate(() => {
      if (popupWindow && !popupWindow.isDestroyed() && !popupWindow.isFocused()) {
        popupWindow.hide();
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
  }
};

/**
 * Gets the current popup window instance
 */
export const getTrayPopup = (): BrowserWindow | null => {
  return popupWindow;
};
