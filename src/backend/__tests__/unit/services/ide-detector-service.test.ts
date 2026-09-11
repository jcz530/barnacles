import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { commandExists } from '@shared/utils/platform';

const TEST_HOME = '/Users/tester';

// Force macOS behavior so the .app-bundle detection path runs deterministically
// regardless of the host platform running the test suite.
vi.mock('@shared/utils/platform', () => ({
  isMac: true,
  isWindows: false,
  isLinux: false,
  commandExists: vi.fn().mockResolvedValue(false),
  getHomeDir: () => TEST_HOME,
}));

vi.mock('fs/promises', () => ({
  default: {
    access: vi.fn(),
    readdir: vi.fn(),
    readFile: vi.fn(),
  },
}));

import { ideDetectorService } from '@backend/services/ide-detector-service';

const mockedAccess = vi.mocked(fs.access);
const mockedCommandExists = vi.mocked(commandExists);

// The directories findMacAppBundle() searches, mirrored here so expected
// bundle paths are built with path.join (matching the OS separator the
// service uses) rather than hardcoded POSIX strings.
const APPLICATIONS = '/Applications';
const HOME_APPLICATIONS = path.join(TEST_HOME, 'Applications');
const SYSTEM_APPLICATIONS = '/System/Applications';

/**
 * Helper: make fs.access resolve only for the given (dir, bundleName) pairs,
 * joined the same way the service joins them, and reject (ENOENT) otherwise.
 */
function installedBundles(bundles: Array<[dir: string, bundleName: string]>) {
  const installed = new Set(bundles.map(([dir, name]) => path.join(dir, name)));
  mockedAccess.mockImplementation(async (p: any) => {
    if (installed.has(String(p))) return undefined;
    throw new Error('ENOENT');
  });
}

describe('IdeDetectorService.detectInstalledIDEs (macOS)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects JetBrains IDEs installed via Toolbox in ~/Applications', async () => {
    installedBundles([[HOME_APPLICATIONS, 'PhpStorm.app']]);

    const detected = await ideDetectorService.detectInstalledIDEs();
    const phpstorm = detected.find(ide => ide.id === 'phpstorm');

    expect(phpstorm?.installed).toBe(true);
  });

  it('detects PyCharm via an alternate (Community Edition) bundle name', async () => {
    installedBundles([[HOME_APPLICATIONS, 'PyCharm Community Edition.app']]);

    const detected = await ideDetectorService.detectInstalledIDEs();
    const pycharm = detected.find(ide => ide.id === 'pycharm');

    expect(pycharm?.installed).toBe(true);
  });

  it('detects Android Studio and Xcode in /Applications', async () => {
    installedBundles([
      [APPLICATIONS, 'Android Studio.app'],
      [APPLICATIONS, 'Xcode.app'],
    ]);

    const detected = await ideDetectorService.detectInstalledIDEs();

    expect(detected.find(ide => ide.id === 'android-studio')?.installed).toBe(true);
    expect(detected.find(ide => ide.id === 'xcode')?.installed).toBe(true);
  });

  it('detects the additional JetBrains, native, and AI editors', async () => {
    installedBundles([
      [HOME_APPLICATIONS, 'DataGrip.app'],
      [APPLICATIONS, 'Nova.app'],
      [APPLICATIONS, 'Trae.app'],
    ]);

    const detected = await ideDetectorService.detectInstalledIDEs();

    expect(detected.find(ide => ide.id === 'datagrip')?.installed).toBe(true);
    expect(detected.find(ide => ide.id === 'nova')?.installed).toBe(true);
    expect(detected.find(ide => ide.id === 'trae')?.installed).toBe(true);
  });

  it('no longer includes the discontinued Atom editor', async () => {
    installedBundles([]);

    const detected = await ideDetectorService.detectInstalledIDEs();

    expect(detected.find(ide => ide.id === 'atom')).toBeUndefined();
  });

  it('reports an IDE as not installed when no bundle exists and it is not on PATH', async () => {
    installedBundles([]);

    const detected = await ideDetectorService.detectInstalledIDEs();

    expect(detected.find(ide => ide.id === 'phpstorm')?.installed).toBe(false);
    expect(detected.find(ide => ide.id === 'webstorm')?.installed).toBe(false);
  });

  it('finds Sublime Text by its bundle, so it can show its own icon', async () => {
    // Sublime is a windowed editor whose `subl` is only a launcher. It carried
    // no macAppName, so it was detected purely through PATH and was the one GUI
    // editor reporting hasAppIcon: false.
    installedBundles([[APPLICATIONS, 'Sublime Text.app']]);
    mockedCommandExists.mockResolvedValue(false);

    const detected = await ideDetectorService.detectInstalledIDEs();
    const sublime = detected.find(ide => ide.id === 'sublime');

    expect(sublime?.installed).toBe(true);
    expect(sublime?.hasAppIcon).toBe(true);
  });

  it('still finds Sublime Text on PATH when no bundle is in a known location', async () => {
    // Naming the bundle must not narrow detection: Sublime is not macOnly, so
    // an install somewhere we do not search still resolves through `subl`. It
    // simply has no icon to draw.
    installedBundles([]);
    mockedCommandExists.mockResolvedValue(true);

    const detected = await ideDetectorService.detectInstalledIDEs();
    const sublime = detected.find(ide => ide.id === 'sublime');

    expect(sublime?.installed).toBe(true);
    expect(sublime?.hasAppIcon).toBe(false);
  });

  it('searches the same directories the icon route does', async () => {
    // findMacAppBundle delegates to the icon service's resolver rather than
    // keeping a second list. /System/Applications is in that list and was not in
    // the detector's old copy, so finding a bundle there is what tells the two
    // apart -- and a detector that could not see a bundle the route can read
    // would report hasAppIcon: false and withhold an icon that exists.
    installedBundles([[SYSTEM_APPLICATIONS, 'Zed.app']]);
    mockedCommandExists.mockResolvedValue(false);

    const detected = await ideDetectorService.detectInstalledIDEs();
    const zed = detected.find(ide => ide.id === 'zed');

    expect(zed?.installed).toBe(true);
    expect(zed?.hasAppIcon).toBe(true);
  });

  it('does not fall back to PATH for macOnly IDEs when the .app bundle is missing', async () => {
    // No bundles installed, but every command resolves on PATH. A regular IDE
    // should be reported as installed via PATH, while a macOnly IDE (e.g. Xcode)
    // must not — it only ships as an .app bundle.
    installedBundles([]);
    mockedCommandExists.mockResolvedValue(true);

    const detected = await ideDetectorService.detectInstalledIDEs();

    expect(detected.find(ide => ide.id === 'xcode')?.installed).toBe(false);
    expect(detected.find(ide => ide.id === 'webstorm')?.installed).toBe(true);
  });
});
