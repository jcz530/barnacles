import { app, BrowserWindow, dialog, net, powerMonitor } from 'electron';
import type { ProgressInfo, UpdateInfo } from 'electron-updater';
import { CancellationToken } from 'electron-updater';
import { autoUpdater } from 'electron-updater';
import { settingsService } from '../backend/services/settings-service';

let updateCheckInProgress = false;

/**
 * When the in-progress check started, so a wedged one can be written off.
 *
 * The flag is set from the `checking-for-update` event, but only the terminal
 * events clear it. A check that is aborted, or whose resolution is swallowed,
 * leaves it set with nothing to unset it -- and every later check, the timer
 * and the wake handler all short-circuit for the rest of the process. Treating
 * a long-running check as stale is the cheap way out of that dead end.
 */
let updateCheckStartedAt = 0;

/** Past this, an "in progress" check is presumed dead rather than trusted. */
const STALE_CHECK_MS = 5 * 60 * 1000;

/** Where the installer assets live, matching `publish` in electron-builder.yml. */
const RELEASE_ASSET_BASE = 'https://github.com/jcz530/barnacles/releases/download';

/** Long enough to tell "missing" from "slow", short enough not to stall a check. */
const ASSET_PROBE_TIMEOUT_MS = 10_000;

/**
 * Whether the installer for a release actually exists yet.
 *
 * The release workflow publishes the GitHub release and uploads the installers
 * afterwards, so for a window there is a release with nothing behind it.
 * Downloading then 404s, and the user sees "Update failed" for a release that
 * is merely still uploading.
 *
 * This asks the question directly rather than proxying it with a timer. An
 * earlier version waited 30 minutes from `releaseDate`, but that field is
 * stamped when electron-builder packages the app -- before macOS notarization,
 * which routinely takes longer than the whole budget -- so it bore little
 * relation to when the assets appeared.
 *
 * Anything other than a definite 404 counts as present: a timeout, a refused
 * connection or a 5xx says nothing about whether the asset exists, and
 * withholding an update because the network hiccuped would be worse than the
 * race this guards.
 */
async function areReleaseAssetsReady(info: UpdateInfo | undefined): Promise<boolean> {
  const fileName = info?.files?.[0]?.url;
  if (!info?.version || !fileName) return true;

  const url = `${RELEASE_ASSET_BASE}/v${info.version}/${fileName.replace(/ /g, '-')}`;

  try {
    const response = await net.fetch(url, {
      method: 'HEAD',
      // GitHub serves assets as a redirect to object storage; following it is
      // what actually proves the file is there.
      redirect: 'follow',
      signal: AbortSignal.timeout(ASSET_PROBE_TIMEOUT_MS),
    });

    if (response.status === 404) {
      console.log(`⏳ Installer for ${info.version} is not uploaded yet`);
      return false;
    }

    return true;
  } catch (error) {
    // Network trouble is not evidence of a missing asset.
    console.warn('Could not probe release assets; assuming they are ready:', error);
    return true;
  }
}

/**
 * Cancels the download in flight, when there is one.
 *
 * Retained so turning automatic updates off stops the current download rather
 * than only the next one -- bandwidth is the reason the setting exists, so
 * letting a 90MB transfer run to completion after opting out defeats it.
 */
let activeDownloadToken: CancellationToken | undefined;

/**
 * The version the age gate is currently holding back, if any.
 *
 * Refusing an update makes electron-updater report `isUpdateAvailable: false`,
 * which is indistinguishable from genuinely being current -- so without this the
 * menu item would cheerfully say "You're up to date" about a release it is
 * deliberately withholding.
 */
let pendingVersion: string | undefined;

/** Whether a check is genuinely in flight, as opposed to wedged. */
function isCheckInProgress(): boolean {
  if (!updateCheckInProgress) return false;

  if (Date.now() - updateCheckStartedAt > STALE_CHECK_MS) {
    console.warn('⚠️ Previous update check never resolved; treating it as stale');
    updateCheckInProgress = false;
    return false;
  }

  return true;
}

/**
 * The version currently downloaded and waiting for a restart, if any.
 *
 * A version rather than a boolean so a later release can still supersede it.
 * As a flag this was write-once: an app left open for weeks -- the case the
 * periodic check exists for -- would stage one update and then never look
 * again, so a subsequent critical release could not reach it.
 */
let stagedVersion: string | undefined;

/**
 * How often to look for a new release while the app stays open.
 *
 * Barnacles is the kind of app that sits open for days, so a startup-only check
 * meant a long-running session never noticed a release. Six hours keeps that
 * from happening without being chatty -- updates only apply on restart anyway,
 * so finding one promptly matters less than finding it at all.
 */
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

let updateCheckTimer: NodeJS.Timeout | undefined;

/**
 * Held so it can be removed again. `powerMonitor` listeners are not cleared by
 * clearing the interval, and re-registering would stack them.
 */
let resumeHandler: (() => void) | undefined;

/**
 * Stop the periodic update check.
 *
 * Called on quit so a pending timer cannot keep the event loop alive or fire
 * against a half-torn-down app.
 */
export function stopPeriodicUpdateChecks(): void {
  if (updateCheckTimer) {
    clearInterval(updateCheckTimer);
    updateCheckTimer = undefined;
  }

  // Without this the wake handler survives the "stop" and can fire a check
  // during shutdown -- the exact thing stopping is meant to prevent.
  if (resumeHandler) {
    powerMonitor.removeListener('resume', resumeHandler);
    resumeHandler = undefined;
  }
}

/**
 * Begin checking for updates on a timer, and after the machine wakes.
 *
 * The timer lives in the main process rather than the renderer because the
 * window is not a reliable host: with the tray icon enabled the window can be
 * closed while the app keeps running, which would silently end a renderer-side
 * interval.
 *
 * A sleeping machine does not run timers, so a laptop shut for a week comes
 * back with a badly stale interval -- `resume` is what turns that into a prompt
 * check instead of waiting out the remainder of the period.
 */
function startPeriodicUpdateChecks(): void {
  stopPeriodicUpdateChecks();

  updateCheckTimer = setInterval(() => {
    void checkForUpdates();
  }, UPDATE_CHECK_INTERVAL_MS);

  // Don't hold the event loop open just for an update check.
  updateCheckTimer.unref?.();

  resumeHandler = () => {
    void checkForUpdates();
  };
  powerMonitor.on('resume', resumeHandler);
}

/**
 * Turn background downloading on or off.
 *
 * Exported because the preference lives in the database but has to be applied
 * to this module's `autoUpdater` singleton, which only the main process can
 * reach. The settings route calls this so a toggle takes effect immediately
 * rather than at the next launch.
 */
export function setAutoDownload(enabled: boolean): void {
  autoUpdater.autoDownload = enabled;

  // Turning it off mid-transfer stops that transfer too. `autoDownload` alone
  // only governs the next check, so without this someone opting out on a
  // metered connection would still pay for the download already running.
  if (!enabled && activeDownloadToken) {
    console.log('🛑 Cancelling in-flight update download');
    activeDownloadToken.cancel();
    activeDownloadToken = undefined;
  }
}

/**
 * Initialize the auto-updater and set up event handlers
 */
export async function initializeUpdater(): Promise<void> {
  // Don't check for updates in development
  if (!app.isPackaged) {
    console.log('🔧 Auto-updater disabled in development mode');
    return;
  }

  console.log('🔄 Initializing auto-updater...');

  // Apply whatever has been downloaded on the next quit. The download itself is
  // gated below, so this only ever installs something the user's own setting
  // allowed onto the disk -- and it is what lets "restart to update" be the
  // whole of the user-facing story.
  autoUpdater.autoInstallOnAppQuit = true;

  /*
   * Hold back a release whose installer has not been uploaded yet.
   *
   * This has to run here rather than in the `update-available` handler.
   * AppUpdater emits that event and *then* starts the auto-download two lines
   * later (AppUpdater.js:414 and :422), so returning early from the handler
   * suppresses the notification while the download proceeds anyway -- and fails
   * with a 404 the user sees as "Update failed". `isUpdateSupported` is
   * consulted before either (AppUpdater.js:348), so refusing here stops both,
   * and it is awaited, so the probe can be async.
   */
  autoUpdater.isUpdateSupported = async (info: UpdateInfo) => {
    if (await areReleaseAssetsReady(info)) {
      pendingVersion = undefined;
      return true;
    }

    pendingVersion = info?.version;
    // Reported as its own state rather than silence, so someone who pressed
    // Check Now can see why nothing happened.
    sendToAllWindows('update:pending', { version: info?.version });
    return false;
  };

  // Whether a found update downloads on its own is the user's call. A missing
  // or unreadable setting should not silently disable updates, so fall back to
  // the default-on behaviour rather than to false.
  try {
    autoUpdater.autoDownload = (await settingsService.getValue<boolean>('autoUpdate')) ?? true;
  } catch (error) {
    console.error('Failed to read autoUpdate setting; defaulting to on:', error);
    autoUpdater.autoDownload = true;
  }

  // Event: Checking for updates
  autoUpdater.on('checking-for-update', () => {
    console.log('🔍 Checking for updates...');
    updateCheckInProgress = true;
    updateCheckStartedAt = Date.now();
    sendToAllWindows('update:checking');
  });

  // Event: Update available
  autoUpdater.on('update-available', (info?: UpdateInfo) => {
    updateCheckInProgress = false;
    console.log('✨ Update available:', info?.version);
    sendToAllWindows('update:available', {
      version: info?.version,
      releaseDate: info?.releaseDate,
      releaseNotes: info?.releaseNotes,
    });
  });

  // Event: No update available
  autoUpdater.on('update-not-available', (info?: UpdateInfo) => {
    updateCheckInProgress = false;

    // Refusing an update in `isUpdateSupported` makes electron-updater report
    // it as unavailable and emit this immediately afterwards. Forwarding it
    // would overwrite the `pending` state set moments earlier and tell the user
    // they are up to date -- about a release we are deliberately withholding.
    if (pendingVersion) {
      console.log(`⏳ Holding ${pendingVersion}; not reporting up to date`);
      return;
    }

    console.log('✅ App is up to date:', info?.version);
    sendToAllWindows('update:not-available', {
      version: info?.version,
    });
  });

  // Event: Download progress
  /*
   * Payloads are defensive throughout.
   *
   * These run inside an EventEmitter in the main process, so a TypeError on a
   * missing field is an uncaught exception, not a rejected promise something
   * can catch. electron-updater's differential downloader has shipped partial
   * progress payloads on resumed downloads, and `percent.toFixed()` on an
   * absent field would take the process down.
   */
  autoUpdater.on('download-progress', (progress?: ProgressInfo) => {
    const percent = progress?.percent ?? 0;
    console.log(`📥 Download progress: ${percent.toFixed(2)}%`);
    sendToAllWindows('update:download-progress', {
      percent,
      bytesPerSecond: progress?.bytesPerSecond ?? 0,
      transferred: progress?.transferred ?? 0,
      total: progress?.total ?? 0,
    });
  });

  // Event: Update downloaded
  autoUpdater.on('update-downloaded', (info?: UpdateInfo) => {
    // electron-updater re-emits this when downloadUpdate() is called for a
    // version already on disk. Re-broadcasting would clear the renderer's
    // dismissal and throw the restart prompt back at someone who chose Later.
    if (info?.version && info.version === stagedVersion) {
      console.log('✅ Update already staged, not re-announcing:', info.version);
      return;
    }

    console.log('✅ Update downloaded:', info?.version);
    stagedVersion = info?.version;
    activeDownloadToken = undefined;
    sendToAllWindows('update:downloaded', {
      version: info?.version,
      releaseDate: info?.releaseDate,
      releaseNotes: info?.releaseNotes,
    });
  });

  // Event: Error
  autoUpdater.on('error', (error?: Error) => {
    console.error('❌ Update error:', error);
    updateCheckInProgress = false;
    activeDownloadToken = undefined;
    // An install or download that failed leaves nothing usable staged; holding
    // the version would suppress checks for a build that never arrives.
    stagedVersion = undefined;
    sendToAllWindows('update:error', {
      message: error?.message ?? 'The update could not be completed.',
    });
  });

  // The first check is still the renderer's to trigger once it is ready; this
  // only covers the long tail of an app that stays open afterwards.
  startPeriodicUpdateChecks();
}

/**
 * Manually check for updates
 */
export async function checkForUpdates(): Promise<void> {
  if (!app.isPackaged) {
    console.log('⚠️ Update check skipped: running in development mode');
    return;
  }

  if (isCheckInProgress()) {
    console.log('⚠️ Update check already in progress');
    return;
  }

  try {
    updateCheckInProgress = true;
    updateCheckStartedAt = Date.now();
    const result = await autoUpdater.checkForUpdates();

    // Same capture as checkForUpdates: a download started from the menu has to
    // be cancellable too, or toggling the setting off leaves it running.
    if (result?.downloadPromise) {
      activeDownloadToken = result.cancellationToken;
    }

    // With autoDownload on, the download starts inside this call, so its token
    // is only reachable here. Holding it is what lets the setting cancel a
    // transfer already under way.
    if (result?.downloadPromise) {
      activeDownloadToken = result.cancellationToken;
    }
  } catch (error) {
    console.error('Failed to check for updates:', error);
  } finally {
    // Reset here, not only in the event handlers. A rejection does not reliably
    // emit `error`, and without this the flag stuck on and killed every
    // subsequent check -- the timer, the wake handler and the Check Now button
    // -- for the rest of the process lifetime.
    updateCheckInProgress = false;
  }
}

/**
 * Check for updates from a user-initiated action (the menu item), reporting the
 * outcome in a dialog.
 *
 * The renderer's own check is fire-and-forget: it listens for the broadcast
 * events and only surfaces something when there is an update to act on. A menu
 * click needs an answer either way, otherwise "Check for Updates..." looks
 * broken when you are already current -- so this resolves the check here and
 * says so.
 */
export async function checkForUpdatesInteractive(): Promise<void> {
  const parentWindow = BrowserWindow.getFocusedWindow() ?? undefined;
  const showMessage = async (options: Electron.MessageBoxOptions) => {
    if (parentWindow) {
      await dialog.showMessageBox(parentWindow, options);
    } else {
      await dialog.showMessageBox(options);
    }
  };

  // Updates are not wired up in development, so say that rather than silently
  // doing nothing.
  if (!app.isPackaged) {
    await showMessage({
      type: 'info',
      message: 'Update checks are disabled in development',
      detail: `Running Barnacles ${app.getVersion()} from source.`,
      buttons: ['OK'],
    });
    return;
  }

  if (isCheckInProgress()) {
    await showMessage({
      type: 'info',
      message: 'Already checking for updates',
      buttons: ['OK'],
    });
    return;
  }

  try {
    // Claim the guard this function also reads, so two quick menu clicks cannot
    // both get past it before any event lands.
    updateCheckInProgress = true;
    updateCheckStartedAt = Date.now();
    const result = await autoUpdater.checkForUpdates();
    // A null result means the check did not run at all (no update feed
    // configured, for instance) -- do not claim the app is up to date.
    if (!result) {
      await showMessage({
        type: 'info',
        message: 'Could not check for updates',
        detail: 'The update service did not respond. Please try again later.',
        buttons: ['OK'],
      });
      return;
    }

    // Checked before the up-to-date branch: the gate refusing an update makes
    // electron-updater report it as unavailable, which would otherwise be
    // reported to the user as being current.
    if (pendingVersion) {
      await showMessage({
        type: 'info',
        message: 'An update is being prepared',
        detail: `Version ${pendingVersion} was just published and is not ready to install yet. Barnacles will pick it up automatically.`,
        buttons: ['OK'],
      });
      return;
    }

    // Trust the library's own verdict rather than comparing version strings,
    // which gets subtle with prereleases and build numbers.
    if (!result.isUpdateAvailable) {
      await showMessage({
        type: 'info',
        message: "You're up to date",
        detail: `Barnacles ${app.getVersion()} is the latest version.`,
        buttons: ['OK'],
      });
      return;
    }

    // Otherwise the renderer's UpdateNotification is already offering it, so a
    // dialog here would only double up.
  } catch (error) {
    console.error('Failed to check for updates:', error);
    await showMessage({
      type: 'error',
      message: 'Could not check for updates',
      detail: error instanceof Error ? error.message : String(error),
      buttons: ['OK'],
    });
  } finally {
    // Same reasoning as checkForUpdates: this path bypasses that function, so
    // it has to clear the flag it set rather than trusting an event to arrive.
    updateCheckInProgress = false;
  }
}

/**
 * Download the available update
 */
export async function downloadUpdate(): Promise<void> {
  if (!app.isPackaged) {
    console.log('⚠️ Update download skipped: running in development mode');
    return;
  }

  try {
    console.log('📥 Starting update download...');
    // Our own token, so a manually started download is just as cancellable as
    // one the check kicked off.
    const token = new CancellationToken();
    activeDownloadToken = token;
    await autoUpdater.downloadUpdate(token);
  } catch (error) {
    console.error('Failed to download update:', error);
  } finally {
    activeDownloadToken = undefined;
  }
}

/**
 * Quit and install the downloaded update
 */
export function quitAndInstall(): void {
  if (!app.isPackaged) {
    console.log('⚠️ Update install skipped: running in development mode');
    return;
  }

  console.log('🔄 Quitting and installing update...');
  autoUpdater.quitAndInstall(false, true);
}

/**
 * Get the current app version
 */
export function getCurrentVersion(): string {
  return app.getVersion();
}

/**
 * Send a message to all renderer windows
 */
function sendToAllWindows(channel: string, data?: unknown): void {
  const windows = BrowserWindow.getAllWindows();
  windows.forEach(window => {
    if (!window.isDestroyed()) {
      window.webContents.send(channel, data);
    }
  });
}
