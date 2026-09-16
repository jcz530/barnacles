import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DownloadProgress, UpdateError, UpdateInfo } from '../../shared/types/updater';

/*
 * The renderer half of the updater.
 *
 * Worth testing directly rather than through a component: the interesting
 * logic is not rendering, it is deciding whether a failure deserves to
 * interrupt the user and whether a download should narrate itself. That lives
 * in module state driven entirely by main-process events, which a stubbed
 * bridge reproduces exactly -- no DOM required, so this runs in the repo's
 * existing node environment.
 */

type Handler<T> = (payload: T) => void;

/** Stands in for the preload bridge, keeping each subscription so tests can fire it. */
function createElectronApiStub() {
  const handlers: {
    checking: Handler<void>[];
    available: Handler<UpdateInfo>[];
    notAvailable: Handler<UpdateInfo>[];
    pending: Handler<UpdateInfo>[];
    progress: Handler<DownloadProgress>[];
    downloaded: Handler<UpdateInfo>[];
    error: Handler<UpdateError>[];
  } = {
    checking: [],
    available: [],
    notAvailable: [],
    pending: [],
    progress: [],
    downloaded: [],
    error: [],
  };

  const subscribe =
    <T>(list: Handler<T>[]) =>
    (callback: Handler<T>) => {
      list.push(callback);
      return () => {
        const index = list.indexOf(callback);
        if (index >= 0) list.splice(index, 1);
      };
    };

  return {
    handlers,
    api: {
      updateGetVersion: vi.fn().mockResolvedValue('0.13.0'),
      updateCheck: vi.fn().mockResolvedValue(undefined),
      updateDownload: vi.fn().mockResolvedValue(undefined),
      updateInstall: vi.fn().mockResolvedValue(undefined),
      onUpdateChecking: subscribe(handlers.checking),
      onUpdateAvailable: subscribe(handlers.available),
      onUpdateNotAvailable: subscribe(handlers.notAvailable),
      onUpdatePending: subscribe(handlers.pending),
      onUpdateDownloadProgress: subscribe(handlers.progress),
      onUpdateDownloaded: subscribe(handlers.downloaded),
      onUpdateError: subscribe(handlers.error),
    },
  };
}

let stub: ReturnType<typeof createElectronApiStub>;

/**
 * Re-import with a fresh registry.
 *
 * The composable is a deliberate singleton, so a cached copy would carry one
 * test's state into the next.
 */
async function loadUpdater() {
  vi.resetModules();
  return import('./useUpdater');
}

/** Fire an event the way the main process would. */
function emit<T>(list: Handler<T>[], payload?: T) {
  list.forEach(handler => handler(payload as T));
}

beforeEach(() => {
  vi.useFakeTimers();
  stub = createElectronApiStub();
  (globalThis as { window?: unknown }).window = { electronAPI: stub.api };
});

afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as { window?: unknown }).window;
});

describe('useUpdater', () => {
  it('subscribes once however many callers there are', async () => {
    const { useUpdater } = await loadUpdater();

    useUpdater();
    useUpdater();
    useUpdater();

    // Three surfaces read this state. Subscribing per caller gave each its own
    // listeners and its own startup check.
    expect(stub.handlers.available).toHaveLength(1);
    expect(stub.api.updateGetVersion).toHaveBeenCalledTimes(1);
  });

  it('reads the current version from the bridge', async () => {
    const { useUpdater } = await loadUpdater();
    const { updateState } = useUpdater();

    await vi.advanceTimersByTimeAsync(0);
    expect(updateState.value.currentVersion).toBe('0.13.0');
  });

  it('checks once shortly after start', async () => {
    const { useUpdater } = await loadUpdater();
    useUpdater();

    expect(stub.api.updateCheck).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(3000);
    expect(stub.api.updateCheck).toHaveBeenCalledTimes(1);
  });

  it('does nothing outside Electron, where there is no bridge', async () => {
    (globalThis as { window?: unknown }).window = {};

    const { useUpdater } = await loadUpdater();
    expect(() => useUpdater()).not.toThrow();
  });
});

describe('error notification', () => {
  it('interrupts when the user was waiting on a check', async () => {
    const { useUpdater } = await loadUpdater();
    const { isDismissed, checkForUpdates } = useUpdater();

    await checkForUpdates();
    emit(stub.handlers.checking);
    emit(stub.handlers.error, { message: 'offline' });

    // They asked a question; they get the answer, however unwelcome.
    expect(isDismissed.value).toBe(false);
  });

  it('interrupts when the user started the download', async () => {
    const { useUpdater } = await loadUpdater();
    const { isDismissed, downloadUpdate } = useUpdater();

    await downloadUpdate();
    emit(stub.handlers.error, { message: 'download failed' });

    expect(isDismissed.value).toBe(false);
  });

  it('stays quiet when nothing the user did caused it', async () => {
    const { useUpdater } = await loadUpdater();
    const { updateState, isDismissed } = useUpdater();

    // The six-hourly timer on a flaky connection. Real, but not news -- and no
    // reason to throw a card over someone's work.
    emit(stub.handlers.error, { message: 'network unreachable' });

    expect(isDismissed.value).toBe(true);
    // Still recorded, so the sidebar badge can show it.
    expect(updateState.value.status).toBe('error');
  });

  it('clears a stale error once a check succeeds', async () => {
    const { useUpdater } = await loadUpdater();
    const { updateState } = useUpdater();

    emit(stub.handlers.error, { message: 'transient failure' });
    emit(stub.handlers.notAvailable, { version: '0.13.0' });

    // A lingering message could resurface under a later malformed error.
    expect(updateState.value.error).toBeUndefined();
    expect(updateState.value.status).toBe('not-available');
  });
});

describe('a release that is not ready yet', () => {
  it('records the pending state so the UI can explain itself', async () => {
    const { useUpdater } = await loadUpdater();
    const { updateState, isCheckingForUpdates } = useUpdater();

    emit(stub.handlers.pending, { version: '0.14.0' });

    expect(updateState.value.status).toBe('pending');
    expect(updateState.value.updateInfo?.version).toBe('0.14.0');
    // Check Now has to stop spinning even though nothing was offered.
    expect(isCheckingForUpdates.value).toBe(false);
  });

  it('does not overwrite an active download', async () => {
    const { useUpdater } = await loadUpdater();
    const { updateState } = useUpdater();

    emit(stub.handlers.progress, {
      percent: 40,
      bytesPerSecond: 1,
      transferred: 2,
      total: 3,
    });
    emit(stub.handlers.pending, { version: '0.15.0' });

    expect(updateState.value.status).toBe('downloading');
  });
});

describe('download attribution', () => {
  it('marks a download the user started', async () => {
    const { useUpdater } = await loadUpdater();
    const { isUserInitiatedDownload, downloadUpdate } = useUpdater();

    await downloadUpdate();
    expect(isUserInitiatedDownload.value).toBe(true);
  });

  it('leaves an automatic download unmarked', async () => {
    const { useUpdater } = await loadUpdater();
    const { isUserInitiatedDownload } = useUpdater();

    emit(stub.handlers.progress, {
      percent: 40,
      bytesPerSecond: 1,
      transferred: 2,
      total: 3,
    });

    // This is what keeps the sidebar badge silent for background work.
    expect(isUserInitiatedDownload.value).toBe(false);
  });

  it('forgets the attribution once the download finishes', async () => {
    const { useUpdater } = await loadUpdater();
    const { isUserInitiatedDownload, downloadUpdate } = useUpdater();

    await downloadUpdate();
    emit(stub.handlers.downloaded, { version: '0.14.0' });

    // Otherwise a later automatic download inherits it and narrates itself.
    expect(isUserInitiatedDownload.value).toBe(false);
  });

  it('forgets the attribution after a failure', async () => {
    const { useUpdater } = await loadUpdater();
    const { isUserInitiatedDownload, downloadUpdate } = useUpdater();

    await downloadUpdate();
    emit(stub.handlers.error, { message: 'failed' });

    expect(isUserInitiatedDownload.value).toBe(false);
  });
});

describe('a check running alongside a download', () => {
  it('does not let a check overwrite an active download', async () => {
    const { useUpdater } = await loadUpdater();
    const { updateState } = useUpdater();

    emit(stub.handlers.progress, {
      percent: 40,
      bytesPerSecond: 1,
      transferred: 2,
      total: 3,
    });
    expect(updateState.value.status).toBe('downloading');

    // The six-hourly timer can fire mid-download; letting it through made the
    // progress badge vanish.
    emit(stub.handlers.checking);
    expect(updateState.value.status).toBe('downloading');
  });

  it('does not report being up to date during a download', async () => {
    const { useUpdater } = await loadUpdater();
    const { updateState } = useUpdater();

    emit(stub.handlers.progress, {
      percent: 40,
      bytesPerSecond: 1,
      transferred: 2,
      total: 3,
    });
    emit(stub.handlers.notAvailable, { version: '0.13.0' });

    expect(updateState.value.status).toBe('downloading');
  });
});

describe('dismissal', () => {
  it('silences the toast without discarding the update', async () => {
    const { useUpdater } = await loadUpdater();
    const { updateState, isDismissed, dismissUpdate } = useUpdater();

    emit(stub.handlers.downloaded, { version: '0.14.0' });
    dismissUpdate();

    expect(isDismissed.value).toBe(true);
    // The badge reads status, so the update is quieted, never lost.
    expect(updateState.value.status).toBe('downloaded');
  });

  it('speaks up again for a genuinely new version', async () => {
    const { useUpdater } = await loadUpdater();
    const { isDismissed, dismissUpdate } = useUpdater();

    emit(stub.handlers.downloaded, { version: '0.14.0' });
    dismissUpdate();
    emit(stub.handlers.available, { version: '0.15.0' });

    expect(isDismissed.value).toBe(false);
  });
});

describe('check feedback', () => {
  it('reports checking straight away, without waiting for an event', async () => {
    const { useUpdater } = await loadUpdater();
    const { isCheckingForUpdates } = useUpdater();

    let resolveCheck: () => void = () => {};
    stub.api.updateCheck.mockReturnValueOnce(
      new Promise<void>(resolve => {
        resolveCheck = resolve;
      })
    );

    const { checkForUpdates } = useUpdater();
    const pending = checkForUpdates();

    // Main returns silently when a check is already running, emitting nothing,
    // so waiting for the broadcast left the button looking broken.
    expect(isCheckingForUpdates.value).toBe(true);

    resolveCheck();
    await pending;
    expect(isCheckingForUpdates.value).toBe(false);
  });
});
