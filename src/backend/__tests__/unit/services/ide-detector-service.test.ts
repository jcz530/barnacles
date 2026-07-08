import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs/promises';

// Force macOS behavior so the .app-bundle detection path runs deterministically
// regardless of the host platform running the test suite.
vi.mock('@shared/utils/platform', () => ({
  isMac: true,
  isWindows: false,
  isLinux: false,
  commandExists: vi.fn().mockResolvedValue(false),
  getHomeDir: () => '/Users/tester',
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

/**
 * Helper: make fs.access resolve only for the given set of absolute bundle
 * paths, and reject (ENOENT) for everything else.
 */
function installedBundles(paths: string[]) {
  const installed = new Set(paths);
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
    installedBundles(['/Users/tester/Applications/PhpStorm.app']);

    const detected = await ideDetectorService.detectInstalledIDEs();
    const phpstorm = detected.find(ide => ide.id === 'phpstorm');

    expect(phpstorm?.installed).toBe(true);
  });

  it('detects PyCharm via an alternate (Community Edition) bundle name', async () => {
    installedBundles(['/Users/tester/Applications/PyCharm Community Edition.app']);

    const detected = await ideDetectorService.detectInstalledIDEs();
    const pycharm = detected.find(ide => ide.id === 'pycharm');

    expect(pycharm?.installed).toBe(true);
  });

  it('detects Android Studio and Xcode in /Applications', async () => {
    installedBundles(['/Applications/Android Studio.app', '/Applications/Xcode.app']);

    const detected = await ideDetectorService.detectInstalledIDEs();

    expect(detected.find(ide => ide.id === 'android-studio')?.installed).toBe(true);
    expect(detected.find(ide => ide.id === 'xcode')?.installed).toBe(true);
  });

  it('detects the additional JetBrains, native, and AI editors', async () => {
    installedBundles([
      '/Users/tester/Applications/DataGrip.app',
      '/Applications/Nova.app',
      '/Applications/Trae.app',
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
});
