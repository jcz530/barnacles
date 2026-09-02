import { app, BrowserWindow, Menu, MenuItemConstructorOptions, shell } from 'electron';
import { createAppWindow } from './main';
import { toggleFindOverlay } from './find-overlay-manager';
import { checkForUpdatesInteractive } from './updater';

const ISSUES_URL = 'https://github.com/jcz530/barnacles/issues';
const SITE_URL = 'https://barnacles.app';

/**
 * Focus a main window and ask its renderer to route to Settings, creating a
 * window first if every one is closed (macOS keeps the menu bar alive then).
 * Utility windows -- the tray popup, the find overlay -- have no router, so
 * they are filtered out the same way the window IPC bridge does it.
 */
const openSettings = async (): Promise<void> => {
  const isMainWindow = (win: BrowserWindow): boolean =>
    !win.isDestroyed() && win.isResizable() && !win.isAlwaysOnTop();

  const focused = BrowserWindow.getFocusedWindow();
  const target =
    focused && isMainWindow(focused) ? focused : BrowserWindow.getAllWindows().find(isMainWindow);

  let window = target;

  if (!window) {
    // A brand new window returns before its renderer has loaded, so the
    // navigation message would land before anything is listening for it.
    window = await createAppWindow();
    if (window.webContents.isLoading()) {
      await new Promise<void>(resolve => {
        window.webContents.once('did-finish-load', () => resolve());
      });
    }
  }

  if (!window.isVisible()) {
    window.show();
  }
  window.focus();
  window.webContents.send('navigate-to-project', '/settings');
};

/**
 * Tag links out to the marketing site so analytics can tell app traffic apart
 * from every other source, and tell which menu item sent it.
 */
const siteUrl = (content: string): string => {
  const url = new URL(SITE_URL);
  url.searchParams.set('utm_source', 'barnacles-app');
  url.searchParams.set('utm_medium', 'app-menu');
  url.searchParams.set('utm_campaign', 'in-app-links');
  url.searchParams.set('utm_content', content);
  return url.toString();
};

export const createMenu = (): void => {
  const isMac = process.platform === 'darwin';

  // Without this the native About panel falls back to bare defaults. macOS only
  // accepts this fixed set of fields, so anything richer would need a custom
  // window instead.
  app.setAboutPanelOptions({
    applicationName: app.getName(),
    applicationVersion: app.getVersion(),
    version: app.getVersion(),
    copyright: 'Copyright © 2025 Joe Czubiak',
    // credits is display text, not a link, so it keeps the bare URL -- a visible
    // query string would just look like spam in the About box.
    credits: 'App for developers.\nhttps://barnacles.app',
    authors: ['Joe Czubiak'],
    website: siteUrl('about-panel'),
  });

  const checkForUpdatesItem: MenuItemConstructorOptions = {
    label: 'Check for Updates...',
    click: () => {
      void checkForUpdatesInteractive();
    },
  };

  const reportIssueItem: MenuItemConstructorOptions = {
    label: 'Report an Issue',
    click: () => {
      void shell.openExternal(ISSUES_URL);
    },
  };

  // The renderer owns routing, so the menu asks it to navigate rather than
  // loading a URL itself. Accelerator matches the Cmd+, / Ctrl+, hotkey the
  // renderer already handles -- listing it here is what makes it discoverable.
  const settingsItem: MenuItemConstructorOptions = {
    label: isMac ? 'Settings...' : 'Settings',
    accelerator: isMac ? 'Cmd+,' : 'Ctrl+,',
    click: () => {
      void openSettings();
    },
  };

  // Helper function to get window menu items
  const getWindowMenuItems = (): MenuItemConstructorOptions[] => {
    const windows = BrowserWindow.getAllWindows();
    return windows.map((window, index) => ({
      label: window.getTitle() || `Window ${index + 1}`,
      type: 'checkbox' as const,
      checked: window.isFocused(),
      click: () => {
        window.show();
        window.focus();
      },
    }));
  };

  const template: MenuItemConstructorOptions[] = [
    // App Menu (macOS only)
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              checkForUpdatesItem,
              { type: 'separator' as const },
              settingsItem,
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),
    // File Menu
    {
      label: 'File',
      submenu: [
        {
          label: 'New Window',
          accelerator: isMac ? 'Cmd+N' : 'Ctrl+N',
          click: async () => {
            await createAppWindow();
          },
        },
        { type: 'separator' as const },
        ...(isMac ? [] : [settingsItem, { type: 'separator' as const }]),
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },
    // Edit Menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' as const },
              { role: 'delete' as const },
              { role: 'selectAll' as const },
              { type: 'separator' as const },
              {
                label: 'Find',
                accelerator: 'Cmd+F',
                click: () => {
                  const focusedWindow = BrowserWindow.getFocusedWindow();
                  if (focusedWindow) {
                    // If focused window is the overlay, target its parent
                    const targetWindow = focusedWindow.getParentWindow() || focusedWindow;
                    toggleFindOverlay(targetWindow);
                  }
                },
              },
            ]
          : [
              { role: 'delete' as const },
              { type: 'separator' as const },
              { role: 'selectAll' as const },
              { type: 'separator' as const },
              {
                label: 'Find',
                accelerator: 'Ctrl+F',
                click: () => {
                  const focusedWindow = BrowserWindow.getFocusedWindow();
                  if (focusedWindow) {
                    // If focused window is the overlay, target its parent
                    const targetWindow = focusedWindow.getParentWindow() || focusedWindow;
                    toggleFindOverlay(targetWindow);
                  }
                },
              },
            ]),
      ],
    },
    // View Menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        ...(!app.isPackaged ? [{ role: 'toggleDevTools' as const }] : []),
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
      ],
    },
    // Window Menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac
          ? [{ type: 'separator' as const }, { role: 'front' as const }]
          : [{ role: 'close' as const }]),
        { type: 'separator' as const },
        ...getWindowMenuItems(),
      ],
    },
    // Help Menu
    {
      role: 'help' as const,
      submenu: [
        {
          label: 'Learn More',
          click: () => {
            void shell.openExternal(siteUrl('help-learn-more'));
          },
        },
        reportIssueItem,
        // Windows and Linux have no app menu, so this is their only route to it.
        ...(isMac ? [] : [{ type: 'separator' as const }, checkForUpdatesItem]),
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
};
