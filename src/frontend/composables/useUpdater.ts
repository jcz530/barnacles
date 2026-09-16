import { readonly, ref } from 'vue';
import type { ElectronAPI } from '../../shared/types/electron';
import type {
  DownloadProgress,
  UpdateError,
  UpdateInfo,
  UpdateState,
} from '../../shared/types/updater';

/**
 * Shared auto-update state.
 *
 * Module-level rather than per-call, because three surfaces now read the same
 * update: the toast in App.vue, the sidebar badge, and the row on the settings
 * page. Building this state inside the composable gave each caller its own
 * listeners and its own startup check, so the same update would be fetched
 * several times over and a dismissal in one place left the others showing it.
 *
 * Mirrors useCommandPaletteState -- one source of truth, no prop drilling
 * between parts of the tree that have no relationship to each other.
 */
const updateState = ref<UpdateState>({
  status: 'idle',
  currentVersion: '0.0.0',
});

const isCheckingForUpdates = ref(false);
const isDownloading = ref(false);

/**
 * Whether the user has waved off the current update.
 *
 * Kept apart from `status` so dismissing only silences the toast: the sidebar
 * badge keeps reading `status` and stays put. An update that has been
 * downloaded is never truly dismissed, only quieted -- it is already on disk
 * and will apply on the next quit.
 */
const isDismissed = ref(false);

/**
 * Whether the user asked for this download themselves.
 *
 * Decides if progress is worth showing. A download the user started is one they
 * are waiting on, so it needs to report itself; one that started on its own is
 * background work, and narrating it undercuts the whole point of automatic
 * updates -- the update should simply turn up finished.
 *
 * Tracked here rather than read from the `autoUpdate` setting because the
 * setting describes what happens by default, not what triggered the download in
 * hand: someone can turn automatic updates off and still press Download.
 */
const isUserInitiatedDownload = ref(false);

/** Guards the one-time listener registration below. */
let isInitialized = false;

/**
 * The preload bridge, or undefined when there is no Electron around it.
 *
 * Read through `globalThis` rather than the `window` global so this module can
 * be imported under the test project's node config, which has no DOM lib. It is
 * also honest about the real contract: outside Electron -- a page opened
 * straight from the Vite dev server -- there is no bridge at all.
 */
function bridge(): ElectronAPI | undefined {
  return (globalThis as { window?: { electronAPI?: ElectronAPI } }).window?.electronAPI;
}

/**
 * Subscribe to the main process's update events. Runs once per renderer.
 *
 * Nothing unsubscribes: these listeners live as long as the window does, which
 * is the point -- an update can land at any time, and the badge has to notice
 * it whether or not any particular component happens to be mounted. The old
 * per-component cleanup is what made a singleton necessary in the first place.
 */
function initialize(): void {
  if (isInitialized) return;
  isInitialized = true;

  const api = bridge();
  if (!api) return;

  void api
    .updateGetVersion()
    .then(version => {
      updateState.value.currentVersion = version;
    })
    .catch((error: unknown) => {
      console.error('Failed to get current version:', error);
    });

  api.onUpdateChecking(() => {
    isCheckingForUpdates.value = true;
    // A download in flight outranks a check. The periodic check can fire
    // mid-download, and letting it overwrite the status would make the progress
    // badge vanish and, on 'not-available', claim the app is up to date while
    // it is still fetching an update.
    if (updateState.value.status === 'downloading') return;
    updateState.value.status = 'checking';
  });

  api.onUpdateAvailable((info: UpdateInfo) => {
    updateState.value.status = 'available';
    updateState.value.updateInfo = info;
    // A check that got an answer supersedes whatever failed last time; a stale
    // message left here would resurface under a later malformed error.
    updateState.value.error = undefined;
    isCheckingForUpdates.value = false;
    // A genuinely new version is a new decision to put to the user.
    isDismissed.value = false;
    isUserInitiatedDownload.value = false;
  });

  api.onUpdatePending((info: UpdateInfo) => {
    isCheckingForUpdates.value = false;
    updateState.value.error = undefined;
    if (updateState.value.status === 'downloading') return;
    updateState.value.status = 'pending';
    updateState.value.updateInfo = info;
  });

  api.onUpdateNotAvailable((info: UpdateInfo) => {
    isCheckingForUpdates.value = false;
    updateState.value.error = undefined;
    // Same reasoning as above: do not overwrite an active download, or a
    // concurrent check reports "Up to date" over a running one.
    if (updateState.value.status === 'downloading') return;
    updateState.value.status = 'not-available';
    updateState.value.updateInfo = info;
  });

  api.onUpdateDownloadProgress((progress: DownloadProgress) => {
    updateState.value.status = 'downloading';
    updateState.value.downloadProgress = progress;
    isDownloading.value = true;
  });

  api.onUpdateDownloaded((info: UpdateInfo) => {
    updateState.value.status = 'downloaded';
    updateState.value.updateInfo = info;
    isDownloading.value = false;
    // Terminal state: the next download is a fresh decision, and leaving this
    // set would make a later automatic download narrate its progress.
    isUserInitiatedDownload.value = false;
    // The update is now installable, which is worth saying once even if the
    // user waved off the earlier "available" prompt.
    isDismissed.value = false;
  });

  api.onUpdateError((error: UpdateError) => {
    // Was this failure the answer to something the user asked for? A check they
    // started, or a download they pressed -- as opposed to the 6-hourly timer
    // or the wake handler, which run entirely on their own.
    const wasUserWaiting = isCheckingForUpdates.value || isUserInitiatedDownload.value;

    updateState.value.status = 'error';
    updateState.value.error = error;
    // Background failures are real, but they are not news. A flaky network on
    // the 6-hour timer should not throw a dialog-sized toast over the user's
    // work about something they never started; the sidebar badge still shows
    // the failed state for anyone who cares to look.
    isDismissed.value = !wasUserWaiting;
    isCheckingForUpdates.value = false;
    isDownloading.value = false;
    isUserInitiatedDownload.value = false;
  });

  // Give the main process a moment to finish wiring its own side before asking.
  setTimeout(() => {
    void checkForUpdates();
  }, 3000);
}

async function checkForUpdates(): Promise<void> {
  // Set optimistically rather than waiting for the `checking` broadcast. Main
  // returns silently when a check is already in flight, emitting nothing at
  // all, so a user clicking Check Now during the six-hourly check would
  // otherwise get no acknowledgement and a button that looks broken.
  isCheckingForUpdates.value = true;
  try {
    await bridge()?.updateCheck();
  } catch (error) {
    console.error('Failed to check for updates:', error);
  } finally {
    // The events that resolve a real check (available / not-available / error)
    // clear this too; this covers the paths that emit nothing.
    isCheckingForUpdates.value = false;
  }
}

async function downloadUpdate(): Promise<void> {
  // Set before the await: the first progress event can arrive while this is
  // still in flight, and it has to find the flag already true.
  isUserInitiatedDownload.value = true;
  try {
    await bridge()?.updateDownload();
  } catch (error) {
    console.error('Failed to download update:', error);
  }
}

async function installUpdate(): Promise<void> {
  try {
    await bridge()?.updateInstall();
  } catch (error) {
    console.error('Failed to install update:', error);
  }
}

/**
 * Silence the current update notification.
 *
 * Only the toast honours this. The sidebar badge deliberately ignores it, so
 * "Later" postpones the interruption without losing track of the update.
 */
function dismissUpdate(): void {
  isDismissed.value = true;
}

/**
 * Undo a dismissal, for the UpdateTest harness.
 *
 * Gated to dev like its siblings below: the app clears this itself when new
 * update info arrives, so nothing in a shipped build should be able to
 * un-dismiss a notification behind the user's back.
 */
export function resetUpdateDismissal(): void {
  if (!import.meta.env.DEV) return;

  isDismissed.value = false;
}

/**
 * Push a state into the shared store by hand, for the UpdateTest harness.
 *
 * The real state only ever moves in response to main-process events, and an
 * unpackaged build never emits any -- so without this there is no way to see
 * the sidebar badge in its real place until a release is cut. Guarded to dev so
 * a production renderer cannot be talked into claiming an update exists.
 */
export function simulateUpdateState(state: UpdateState): void {
  if (!import.meta.env.DEV) return;

  updateState.value = state;
  isCheckingForUpdates.value = state.status === 'checking';
  isDownloading.value = state.status === 'downloading';
}

/** Drive the user-initiated flag from the harness, to see both badge modes. */
export function simulateUserInitiatedDownload(userInitiated: boolean): void {
  if (!import.meta.env.DEV) return;

  isUserInitiatedDownload.value = userInitiated;
}

export function useUpdater() {
  initialize();

  return {
    // Readonly so a caller cannot desync the state the other two surfaces read.
    updateState: readonly(updateState),
    isCheckingForUpdates: readonly(isCheckingForUpdates),
    isDownloading: readonly(isDownloading),
    isDismissed: readonly(isDismissed),
    isUserInitiatedDownload: readonly(isUserInitiatedDownload),
    checkForUpdates,
    downloadUpdate,
    installUpdate,
    dismissUpdate,
  };
}
