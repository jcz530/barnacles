import { app, BrowserWindow, Menu, nativeImage, Tray } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { createAppWindow } from './main';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let tray: Tray | null = null;

/**
 * Creates and initializes the system tray icon
 */
export const createTray = (): Tray => {
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

  // Build the context menu
  updateTrayMenu();

  // Show window on tray icon click (mainly for Windows/Linux)
  tray.on('click', () => {
    showOrCreateWindow();
  });

  return tray;
};

/**
 * Updates the tray context menu with current window state
 */
export const updateTrayMenu = (): void => {
  if (!tray) return;

  const windows = BrowserWindow.getAllWindows();
  const hasWindows = windows.length > 0;
  const isMac = process.platform === 'darwin';

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Barnacles',
      click: () => showOrCreateWindow(),
      enabled: true,
    },
    {
      label: 'New Window',
      accelerator: isMac ? 'Cmd+N' : 'Ctrl+N',
      click: async () => {
        await createAppWindow();
        updateTrayMenu(); // Update menu after new window
      },
    },
    { type: 'separator' },
    ...(hasWindows
      ? [
          {
            label: 'Hide All Windows',
            click: () => {
              windows.forEach(window => window.hide());
            },
          },
          { type: 'separator' as const },
        ]
      : []),
    {
      label: 'Quit Barnacles',
      accelerator: isMac ? 'Cmd+Q' : 'Ctrl+Q',
      click: () => {
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
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
