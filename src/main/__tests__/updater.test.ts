import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Covers the one decision this module makes on the user's behalf: whether a
 * found update downloads without being asked. Everything else here is
 * electron-updater's job, so the mocks below stand in for it and the assertions
 * stay on `autoDownload` and on the development guards.
 */

const mockAutoUpdater: {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  isUpdateSupported?: (info: {
    version?: string;
    files?: Array<{ url: string }>;
  }) => boolean | Promise<boolean>;
  on: ReturnType<typeof vi.fn>;
  checkForUpdates: ReturnType<typeof vi.fn>;
  downloadUpdate: ReturnType<typeof vi.fn>;
  quitAndInstall: ReturnType<typeof vi.fn>;
} = {
  autoDownload: false,
  autoInstallOnAppQuit: false,
  on: vi.fn(),
  checkForUpdates: vi.fn(),
  downloadUpdate: vi.fn(),
  quitAndInstall: vi.fn(),
};

const mockApp = {
  isPackaged: true,
  getVersion: vi.fn(() => '0.13.0'),
};

const getValue = vi.fn();

const mockPowerMonitor = {
  on: vi.fn(),
  removeListener: vi.fn(),
};

/*
 * A real stub window, so the broadcast body actually runs.
 *
 * With getAllWindows() returning [], every sendToAllWindows call was a no-op
 * and the IPC channel names and payload shapes -- the entire contract with
 * useUpdater.ts -- had zero coverage: renaming a channel would have kept the
 * suite green while the badge silently never appeared.
 */
const mockSend = vi.fn();
const mockWindow = {
  isDestroyed: vi.fn(() => false),
  webContents: { send: mockSend },
};
const mockDestroyedWindow = {
  isDestroyed: vi.fn(() => true),
  webContents: { send: vi.fn() },
};
const getAllWindows = vi.fn(() => [mockWindow]);
const showMessageBox = vi.fn();
const getFocusedWindow = vi.fn(() => null);

const mockFetch = vi.fn();

vi.mock('electron', () => ({
  app: mockApp,
  net: { fetch: (...args: unknown[]) => mockFetch(...args) },
  BrowserWindow: {
    getAllWindows: () => getAllWindows(),
    getFocusedWindow: () => getFocusedWindow(),
  },
  dialog: { showMessageBox: (...args: unknown[]) => showMessageBox(...args) },
  powerMonitor: mockPowerMonitor,
}));

class FakeCancellationToken {
  cancel = vi.fn();
}

vi.mock('electron-updater', () => ({
  autoUpdater: mockAutoUpdater,
  CancellationToken: FakeCancellationToken,
}));

vi.mock('../../backend/services/settings-service', () => ({
  settingsService: {
    getValue: (key: string) => getValue(key),
  },
}));

/**
 * Re-import with a fresh module registry each time.
 *
 * The module holds `autoDownload`, the staged flag and the interval timer in
 * module-level state, so a cached copy would carry one test's values into the
 * next and quietly pass.
 */
async function loadUpdater() {
  vi.resetModules();
  return import('../updater');
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  getAllWindows.mockReturnValue([mockWindow]);
  mockWindow.isDestroyed.mockReturnValue(false);
  getFocusedWindow.mockReturnValue(null);
  showMessageBox.mockResolvedValue({ response: 0 });
  // Assets present unless a test says otherwise.
  mockFetch.mockResolvedValue({ status: 200 });
  mockApp.isPackaged = true;
  mockAutoUpdater.autoDownload = false;
  mockAutoUpdater.autoInstallOnAppQuit = false;
  mockAutoUpdater.isUpdateSupported = undefined;
  mockAutoUpdater.checkForUpdates.mockResolvedValue({ isUpdateAvailable: false });
  getValue.mockResolvedValue(true);
});

afterEach(() => {
  vi.useRealTimers();
});

/** Replays a subscription the module registered on autoUpdater. */
function emit(event: string, payload?: unknown) {
  for (const [name, handler] of mockAutoUpdater.on.mock.calls) {
    if (name === event) (handler as (arg?: unknown) => void)(payload);
  }
}

describe('initializeUpdater', () => {
  it('enables background downloads when the setting is on', async () => {
    getValue.mockResolvedValue(true);

    const { initializeUpdater } = await loadUpdater();
    await initializeUpdater();

    expect(getValue).toHaveBeenCalledWith('autoUpdate');
    expect(mockAutoUpdater.autoDownload).toBe(true);
  });

  it('leaves downloads manual when the setting is off', async () => {
    getValue.mockResolvedValue(false);

    const { initializeUpdater } = await loadUpdater();
    await initializeUpdater();

    expect(mockAutoUpdater.autoDownload).toBe(false);
  });

  it('falls back to on when the setting cannot be read', async () => {
    // A database hiccup should not silently strand someone on an old build.
    getValue.mockRejectedValue(new Error('database unavailable'));

    const { initializeUpdater } = await loadUpdater();
    await initializeUpdater();

    expect(mockAutoUpdater.autoDownload).toBe(true);
  });

  it('falls back to on when the setting is missing', async () => {
    getValue.mockResolvedValue(undefined);

    const { initializeUpdater } = await loadUpdater();
    await initializeUpdater();

    expect(mockAutoUpdater.autoDownload).toBe(true);
  });

  it('applies downloaded updates on quit', async () => {
    const { initializeUpdater } = await loadUpdater();
    await initializeUpdater();

    // This is what lets "restart to update" be the whole user-facing story.
    expect(mockAutoUpdater.autoInstallOnAppQuit).toBe(true);
  });

  it('does nothing in development', async () => {
    mockApp.isPackaged = false;

    const { initializeUpdater } = await loadUpdater();
    await initializeUpdater();

    // Never reads the setting, never subscribes -- an unpackaged build has no
    // update feed to talk to.
    expect(getValue).not.toHaveBeenCalled();
    expect(mockAutoUpdater.on).not.toHaveBeenCalled();
  });

  it('subscribes to the updater events the renderer listens for', async () => {
    const { initializeUpdater } = await loadUpdater();
    await initializeUpdater();

    const subscribed = mockAutoUpdater.on.mock.calls.map(call => call[0] as string);
    expect(subscribed).toEqual(
      expect.arrayContaining([
        'checking-for-update',
        'update-available',
        'update-not-available',
        'download-progress',
        'update-downloaded',
        'error',
      ])
    );
  });
});

describe('setAutoDownload', () => {
  it('turns background downloads on and off at runtime', async () => {
    const { setAutoDownload } = await loadUpdater();

    setAutoDownload(true);
    expect(mockAutoUpdater.autoDownload).toBe(true);

    // Turning it off mid-session has to take effect now, not at next launch.
    setAutoDownload(false);
    expect(mockAutoUpdater.autoDownload).toBe(false);
  });
});

describe('development guards', () => {
  beforeEach(() => {
    mockApp.isPackaged = false;
  });

  it('skips the update check', async () => {
    const { checkForUpdates } = await loadUpdater();
    await checkForUpdates();

    expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled();
  });

  it('skips the download', async () => {
    const { downloadUpdate } = await loadUpdater();
    await downloadUpdate();

    expect(mockAutoUpdater.downloadUpdate).not.toHaveBeenCalled();
  });

  it('skips the install', async () => {
    const { quitAndInstall } = await loadUpdater();
    quitAndInstall();

    expect(mockAutoUpdater.quitAndInstall).not.toHaveBeenCalled();
  });
});

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

describe('periodic update checks', () => {
  it('checks again after the interval elapses', async () => {
    const { initializeUpdater } = await loadUpdater();
    await initializeUpdater();

    // Nothing yet -- the first check belongs to the renderer.
    expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(SIX_HOURS_MS);
    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(SIX_HOURS_MS);
    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledTimes(2);
  });

  it('does not check before the interval elapses', async () => {
    const { initializeUpdater } = await loadUpdater();
    await initializeUpdater();

    await vi.advanceTimersByTimeAsync(SIX_HOURS_MS - 1000);
    expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled();
  });

  it('checks when the machine wakes from sleep', async () => {
    const { initializeUpdater } = await loadUpdater();
    await initializeUpdater();

    const resume = mockPowerMonitor.on.mock.calls.find(call => call[0] === 'resume');
    expect(resume).toBeDefined();

    // A machine asleep for a week comes back with a stale timer, so waking is
    // its own trigger rather than waiting out the rest of the period.
    await (resume?.[1] as () => Promise<void>)();
    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it('keeps checking after an update is staged, so a newer one can supersede it', async () => {
    const { initializeUpdater } = await loadUpdater();
    await initializeUpdater();

    emit('update-downloaded', { version: '0.14.0' });

    // An app left open for weeks is exactly what the timer exists for; a staged
    // update must not stop it from finding a later critical release. Paired
    // with the dedupe tests, which cover the other half: checks continue, but a
    // repeat of the *same* version is not re-announced.
    await vi.advanceTimersByTimeAsync(SIX_HOURS_MS);
    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it('removes the wake listener when stopped', async () => {
    const { initializeUpdater, stopPeriodicUpdateChecks } = await loadUpdater();
    await initializeUpdater();

    const handler = mockPowerMonitor.on.mock.calls.find(call => call[0] === 'resume')?.[1];
    stopPeriodicUpdateChecks();

    // Clearing the interval alone left this live, so a wake during shutdown
    // could still fire a check against a half-torn-down app.
    expect(mockPowerMonitor.removeListener).toHaveBeenCalledWith('resume', handler);
  });

  it('does not stack wake listeners when re-initialized', async () => {
    const { initializeUpdater } = await loadUpdater();
    await initializeUpdater();
    await initializeUpdater();

    // Net one: the second init removes the first's handler before adding its
    // own. Asserting a single registration would have passed either way.
    const added = mockPowerMonitor.on.mock.calls.filter(call => call[0] === 'resume').length;
    const removed = mockPowerMonitor.removeListener.mock.calls.filter(
      call => call[0] === 'resume'
    ).length;
    expect(added - removed).toBe(1);
  });

  it('schedules nothing in development', async () => {
    mockApp.isPackaged = false;

    const { initializeUpdater } = await loadUpdater();
    await initializeUpdater();

    await vi.advanceTimersByTimeAsync(SIX_HOURS_MS * 2);
    expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled();
  });

  it('stops the interval firing after the timer is cleared', async () => {
    const { initializeUpdater, stopPeriodicUpdateChecks } = await loadUpdater();
    await initializeUpdater();

    stopPeriodicUpdateChecks();

    await vi.advanceTimersByTimeAsync(SIX_HOURS_MS * 2);
    expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled();
  });
});

describe('check guard recovery', () => {
  it('can check again after a rejected check', async () => {
    const { checkForUpdates } = await loadUpdater();

    mockAutoUpdater.checkForUpdates.mockRejectedValueOnce(new Error('network down'));
    await checkForUpdates();

    // The guard used to stick on when a rejection produced no `error` event,
    // killing the timer, the wake handler and the Check Now button for the
    // rest of the process lifetime.
    mockAutoUpdater.checkForUpdates.mockResolvedValueOnce({ isUpdateAvailable: false });
    await checkForUpdates();

    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledTimes(2);
  });

  it('re-announces a version after a failed install clears it', async () => {
    const { initializeUpdater } = await loadUpdater();
    await initializeUpdater();

    emit('update-downloaded', { version: '0.14.0' });
    emit('error', new Error('install failed'));

    // The staged copy is gone, so the same version arriving again is genuinely
    // new information rather than a duplicate to swallow.
    emit('update-downloaded', { version: '0.14.0' });

    const announcements = mockSend.mock.calls.filter(call => call[0] === 'update:downloaded');
    expect(announcements).toHaveLength(2);
  });
});

describe('broadcasts to the renderer', () => {
  /** The channel/payload contract useUpdater.ts listens on. */
  it('forwards each updater event on its channel', async () => {
    const { initializeUpdater } = await loadUpdater();
    await initializeUpdater();

    emit('checking-for-update');
    expect(mockSend).toHaveBeenCalledWith('update:checking', undefined);

    emit('update-available', { version: '0.14.0', releaseDate: 'x', releaseNotes: 'y' });
    expect(mockSend).toHaveBeenCalledWith('update:available', {
      version: '0.14.0',
      releaseDate: 'x',
      releaseNotes: 'y',
    });

    emit('update-not-available', { version: '0.13.0' });
    expect(mockSend).toHaveBeenCalledWith('update:not-available', { version: '0.13.0' });

    emit('download-progress', {
      percent: 42,
      bytesPerSecond: 1,
      transferred: 2,
      total: 3,
    });
    expect(mockSend).toHaveBeenCalledWith('update:download-progress', {
      percent: 42,
      bytesPerSecond: 1,
      transferred: 2,
      total: 3,
    });

    emit('update-downloaded', { version: '0.14.0', releaseDate: 'x', releaseNotes: 'y' });
    expect(mockSend).toHaveBeenCalledWith('update:downloaded', {
      version: '0.14.0',
      releaseDate: 'x',
      releaseNotes: 'y',
    });

    emit('error', new Error('boom'));
    expect(mockSend).toHaveBeenCalledWith('update:error', { message: 'boom' });
  });

  it('skips destroyed windows', async () => {
    const { initializeUpdater } = await loadUpdater();
    await initializeUpdater();

    getAllWindows.mockReturnValue([mockDestroyedWindow]);
    emit('checking-for-update');

    // Sending to a destroyed window throws inside the event handler, which in
    // the main process is an uncaught exception.
    expect(mockDestroyedWindow.webContents.send).not.toHaveBeenCalled();
  });
});

describe('malformed event payloads', () => {
  /*
   * These run inside an EventEmitter in main, so a TypeError here is an
   * uncaught exception rather than something a caller can catch.
   */
  it('survives an update-downloaded with no info', async () => {
    const { initializeUpdater } = await loadUpdater();
    await initializeUpdater();

    expect(() => emit('update-downloaded', undefined)).not.toThrow();
  });

  it('survives a download-progress with no payload', async () => {
    const { initializeUpdater } = await loadUpdater();
    await initializeUpdater();

    expect(() => emit('download-progress', undefined)).not.toThrow();
    expect(mockSend).toHaveBeenCalledWith('update:download-progress', {
      percent: 0,
      bytesPerSecond: 0,
      transferred: 0,
      total: 0,
    });
  });

  it('survives an error with no error object', async () => {
    const { initializeUpdater } = await loadUpdater();
    await initializeUpdater();

    expect(() => emit('error', undefined)).not.toThrow();
    expect(mockSend).toHaveBeenCalledWith('update:error', {
      message: 'The update could not be completed.',
    });
  });
});

describe('duplicate update-downloaded', () => {
  it('announces a staged version only once', async () => {
    const { initializeUpdater } = await loadUpdater();
    await initializeUpdater();

    emit('update-downloaded', { version: '0.14.0' });
    emit('update-downloaded', { version: '0.14.0' });

    // Re-announcing clears the renderer's dismissal, throwing the restart
    // prompt back at someone who already chose Later.
    const announcements = mockSend.mock.calls.filter(call => call[0] === 'update:downloaded');
    expect(announcements).toHaveLength(1);
  });

  it('announces a genuinely newer version', async () => {
    const { initializeUpdater } = await loadUpdater();
    await initializeUpdater();

    emit('update-downloaded', { version: '0.14.0' });
    emit('update-downloaded', { version: '0.15.0' });

    const announcements = mockSend.mock.calls.filter(call => call[0] === 'update:downloaded');
    expect(announcements).toHaveLength(2);
  });
});

describe('stale check recovery', () => {
  it('lets a new check through once a wedged one goes stale', async () => {
    const { initializeUpdater, checkForUpdates } = await loadUpdater();
    await initializeUpdater();

    // A `checking-for-update` with no terminal event: the check was aborted or
    // its resolution swallowed. Without a staleness escape this wedged every
    // later check, the timer and the wake handler for the process lifetime.
    emit('checking-for-update');

    await checkForUpdates();
    expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled();

    vi.setSystemTime(Date.now() + 6 * 60 * 1000);
    await checkForUpdates();
    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
  });
});

describe('checkForUpdatesInteractive', () => {
  it('says so in development rather than doing nothing', async () => {
    mockApp.isPackaged = false;
    const { checkForUpdatesInteractive } = await loadUpdater();

    await checkForUpdatesInteractive();

    expect(showMessageBox).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Update checks are disabled in development' })
    );
  });

  it('does not claim the app is up to date when the check never ran', async () => {
    const { checkForUpdatesInteractive } = await loadUpdater();
    // A null result means no feed responded -- saying "up to date" would be a
    // lie the user acts on.
    mockAutoUpdater.checkForUpdates.mockResolvedValueOnce(null);

    await checkForUpdatesInteractive();

    expect(showMessageBox).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Could not check for updates' })
    );
  });

  it('reports being up to date', async () => {
    const { checkForUpdatesInteractive } = await loadUpdater();
    mockAutoUpdater.checkForUpdates.mockResolvedValueOnce({ isUpdateAvailable: false });

    await checkForUpdatesInteractive();

    expect(showMessageBox).toHaveBeenCalledWith(
      expect.objectContaining({ message: "You're up to date" })
    );
  });

  it('says an update is being prepared when the age gate holds it back', async () => {
    const { initializeUpdater, checkForUpdatesInteractive } = await loadUpdater();
    await initializeUpdater();

    // Refusing makes electron-updater report the update as unavailable, so
    // without the pending check this would claim "You're up to date" about a
    // release it is deliberately withholding.
    mockFetch.mockResolvedValueOnce({ status: 404 });
    await mockAutoUpdater.isUpdateSupported?.({
      version: '0.14.0',
      files: [{ url: 'Barnacles-0.14.0-arm64.dmg' }],
    });
    mockAutoUpdater.checkForUpdates.mockResolvedValueOnce({ isUpdateAvailable: false });

    await checkForUpdatesInteractive();

    expect(showMessageBox).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'An update is being prepared' })
    );
  });

  it('stays silent when an update exists, leaving it to the renderer', async () => {
    const { checkForUpdatesInteractive } = await loadUpdater();
    mockAutoUpdater.checkForUpdates.mockResolvedValueOnce({ isUpdateAvailable: true });

    await checkForUpdatesInteractive();

    // The badge and toast already offer it; a dialog would double up.
    expect(showMessageBox).not.toHaveBeenCalled();
  });

  it('reports a failed check', async () => {
    const { checkForUpdatesInteractive } = await loadUpdater();
    mockAutoUpdater.checkForUpdates.mockRejectedValueOnce(new Error('offline'));

    await checkForUpdatesInteractive();

    expect(showMessageBox).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error', detail: 'offline' })
    );
  });

  it('recovers the guard after a rejection', async () => {
    const { checkForUpdatesInteractive } = await loadUpdater();
    mockAutoUpdater.checkForUpdates.mockRejectedValueOnce(new Error('offline'));

    await checkForUpdatesInteractive();
    mockAutoUpdater.checkForUpdates.mockResolvedValueOnce({ isUpdateAvailable: false });
    await checkForUpdatesInteractive();

    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledTimes(2);
  });
});

describe('release asset gate', () => {
  /*
   * The gate lives on `isUpdateSupported`, not the `update-available` handler:
   * AppUpdater emits that event and then starts the auto-download two lines
   * later, so refusing in the handler would hide the notification while the
   * download ran on and 404'd.
   */
  const supports = async (version = '0.14.0') =>
    mockAutoUpdater.isUpdateSupported?.({
      version,
      files: [{ url: `Barnacles-${version}-arm64.dmg` }],
    }) ?? true;

  it('refuses a release whose installer is not uploaded yet', async () => {
    const { initializeUpdater } = await loadUpdater();
    await initializeUpdater();

    mockFetch.mockResolvedValueOnce({ status: 404 });
    await expect(supports()).resolves.toBe(false);
  });

  it('allows a release whose installer is there', async () => {
    const { initializeUpdater } = await loadUpdater();
    await initializeUpdater();

    mockFetch.mockResolvedValueOnce({ status: 200 });
    await expect(supports()).resolves.toBe(true);
  });

  it('probes the release download URL for that version', async () => {
    const { initializeUpdater } = await loadUpdater();
    await initializeUpdater();

    await supports('0.14.0');

    expect(mockFetch).toHaveBeenCalledWith(
      'https://github.com/jcz530/barnacles/releases/download/v0.14.0/Barnacles-0.14.0-arm64.dmg',
      expect.objectContaining({ method: 'HEAD' })
    );
  });

  it('tells the renderer the update is pending rather than staying silent', async () => {
    const { initializeUpdater } = await loadUpdater();
    await initializeUpdater();

    mockFetch.mockResolvedValueOnce({ status: 404 });
    await supports();

    // Silence would leave a Check Now click looking like it did nothing.
    expect(mockSend).toHaveBeenCalledWith('update:pending', { version: '0.14.0' });
  });

  it('does not report being up to date while holding a release back', async () => {
    const { initializeUpdater } = await loadUpdater();
    await initializeUpdater();

    mockFetch.mockResolvedValueOnce({ status: 404 });
    await supports();

    // Refusing makes electron-updater emit update-not-available immediately
    // afterwards; forwarding it would overwrite `pending` with "Up to date".
    emit('update-not-available', { version: '0.14.0' });
    const claims = mockSend.mock.calls.filter(call => call[0] === 'update:not-available');
    expect(claims).toHaveLength(0);
  });

  it('picks the release up once the installer lands', async () => {
    const { initializeUpdater } = await loadUpdater();
    await initializeUpdater();

    mockFetch.mockResolvedValueOnce({ status: 404 });
    await expect(supports()).resolves.toBe(false);

    // Refusing is not giving up -- the six-hourly check comes back to it.
    mockFetch.mockResolvedValueOnce({ status: 200 });
    await expect(supports()).resolves.toBe(true);
  });

  it('allows the update when the probe itself fails', async () => {
    const { initializeUpdater } = await loadUpdater();
    await initializeUpdater();

    // A timeout or refused connection says nothing about whether the asset
    // exists; withholding on a network hiccup is worse than the race.
    mockFetch.mockRejectedValueOnce(new Error('network unreachable'));
    await expect(supports()).resolves.toBe(true);
  });

  it('allows the update when there is no file to probe', async () => {
    const { initializeUpdater } = await loadUpdater();
    await initializeUpdater();

    await expect(
      mockAutoUpdater.isUpdateSupported?.({ version: '0.14.0', files: [] })
    ).resolves.toBe(true);
  });
});

describe('cancelling an in-flight download', () => {
  it('cancels the automatic download when the setting is turned off', async () => {
    const { initializeUpdater, checkForUpdates, setAutoDownload } = await loadUpdater();
    await initializeUpdater();

    const token = new FakeCancellationToken();
    mockAutoUpdater.checkForUpdates.mockResolvedValueOnce({
      isUpdateAvailable: true,
      downloadPromise: Promise.resolve([]),
      cancellationToken: token,
    });
    await checkForUpdates();

    setAutoDownload(false);

    // autoDownload alone only governs the next check, so without this a user
    // opting out on a metered connection still pays for the current transfer.
    expect(token.cancel).toHaveBeenCalled();
  });

  it('cancels a manually started download too', async () => {
    const { initializeUpdater, downloadUpdate, setAutoDownload } = await loadUpdater();
    await initializeUpdater();

    let resolveDownload: () => void = () => {};
    mockAutoUpdater.downloadUpdate.mockReturnValueOnce(
      new Promise<string[]>(resolve => {
        resolveDownload = () => resolve([]);
      })
    );

    const pending = downloadUpdate();
    setAutoDownload(false);

    const token = mockAutoUpdater.downloadUpdate.mock.calls[0]?.[0] as FakeCancellationToken;
    expect(token.cancel).toHaveBeenCalled();

    resolveDownload();
    await pending;
  });

  it('does nothing when there is no download running', async () => {
    const { initializeUpdater, setAutoDownload } = await loadUpdater();
    await initializeUpdater();

    expect(() => setAutoDownload(false)).not.toThrow();
  });

  it('does not cancel when the setting is turned on', async () => {
    const { initializeUpdater, checkForUpdates, setAutoDownload } = await loadUpdater();
    await initializeUpdater();

    const token = new FakeCancellationToken();
    mockAutoUpdater.checkForUpdates.mockResolvedValueOnce({
      isUpdateAvailable: true,
      downloadPromise: Promise.resolve([]),
      cancellationToken: token,
    });
    await checkForUpdates();

    setAutoDownload(true);
    expect(token.cancel).not.toHaveBeenCalled();
  });

  it('forgets the token once the download completes', async () => {
    const { initializeUpdater, checkForUpdates, setAutoDownload } = await loadUpdater();
    await initializeUpdater();

    const token = new FakeCancellationToken();
    mockAutoUpdater.checkForUpdates.mockResolvedValueOnce({
      isUpdateAvailable: true,
      downloadPromise: Promise.resolve([]),
      cancellationToken: token,
    });
    await checkForUpdates();

    emit('update-downloaded', { version: '0.14.0' });
    setAutoDownload(false);

    // Cancelling a finished download would be meaningless at best.
    expect(token.cancel).not.toHaveBeenCalled();
  });
});
