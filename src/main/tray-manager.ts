import { app, BrowserWindow, nativeImage, Tray } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { createAppWindow } from './main';
import { createTrayPopup } from './tray-popup-manager';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let tray: Tray | null = null;

/**
 * Creates and initializes the system tray icon
 */
export const createTray = (): Tray => {
  // If tray already exists, return it
  if (tray) {
    return tray;
  }

  // Get the appropriate icon path
  // In development: src/main/assets/tray-icon.png
  // In production: dist/main/assets/tray-icon.png (bundled in the app)
  let iconPath: string;

  if (app.isPackaged) {
    // Production: icon is in dist/main/assets
    iconPath = path.join(__dirname, 'assets', 'tray-iconTemplate.png');
  } else {
    // Development: icon is in src/main/assets
    iconPath = path.join(__dirname, '../../src/main/assets/tray-iconTemplate.png');
  }

  // Create native image with proper scaling for retina displays
  // Note: Using "Template" suffix tells macOS to treat as template image (adapts to light/dark mode)
  const icon = nativeImage.createFromPath(iconPath);
  icon.setTemplateImage(true);

  // Create the tray
  tray = new Tray(icon);
  tray.setToolTip('Barnacles');

  // Disable native context menu by setting an empty menu
  // This prevents the default menu from showing
  // tray.setContextMenu(Menu.buildFromTemplate([]));

  // Show custom popup on both click and right-click
  tray.on('click', () => {
    const bounds = tray!.getBounds();
    createTrayPopup(bounds);
  });

  tray.on('right-click', () => {
    const bounds = tray!.getBounds();
    createTrayPopup(bounds);
  });

  // Native context menu is disabled
  // To re-enable, uncomment updateTrayMenu() call and remove the empty menu above

  return tray;
};

/**
 * Updates the tray (placeholder for future native menu implementation)
 * Currently using custom popup UI instead of native context menu
 */
export const updateTrayMenu = (): void => {
  // No-op: Custom popup UI is used instead of native menu
  // This function is kept for potential future native menu implementation
};

/**
 * Shows an existing window or creates a new one if none exist
 */
const showOrCreateWindow = async (): Promise<void> => {
  const windows = BrowserWindow.getAllWindows();

  if (windows.length > 0) {
    // Show and focus the first window
    const window = windows[0];
    if (!window.isVisible()) {
      window.show();
    }
    window.focus();
  } else {
    // No windows exist, create one
    await createAppWindow();
  }
};

/**
 * Destroys the tray icon
 */
export const destroyTray = (): void => {
  if (tray) {
    tray.destroy();
    tray = null;
  }
};

/**
 * Gets the current tray instance
 */
export const getTray = (): Tray | null => {
  return tray;
};
