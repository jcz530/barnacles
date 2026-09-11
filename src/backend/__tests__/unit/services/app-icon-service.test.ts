import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

/**
 * findAppBundle resolves a bundle name against the standard install locations.
 * Those paths are absolute and machine-specific, so the tests that need a real
 * bundle on disk mock the platform helpers rather than assuming what is
 * installed.
 */
describe('app-icon-service', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  describe('findAppBundle', () => {
    it('returns null off macOS, whatever the name', async () => {
      vi.doMock('../../../../shared/utils/platform', () => ({
        isMac: false,
        getHomeDir: () => '/home/someone',
      }));

      const { findAppBundle } = await import('../../../services/app-icon-service');

      expect(await findAppBundle(['Visual Studio Code.app'])).toBeNull();
    });

    it('returns null when given no bundle names', async () => {
      vi.doMock('../../../../shared/utils/platform', () => ({
        isMac: true,
        getHomeDir: () => '/home/someone',
      }));

      const { findAppBundle } = await import('../../../services/app-icon-service');

      // A tool defined without any bundle name reaches this path.
      expect(await findAppBundle([])).toBeNull();
    });

    it('finds a bundle in ~/Applications, not just /Applications', async () => {
      // JetBrains Toolbox and per-user installs land here, so a search that only
      // looked in /Applications would report those IDEs as icon-less.
      const home = await mkdtemp(path.join(tmpdir(), 'barnacles-icon-home-'));
      await mkdir(path.join(home, 'Applications', 'Fake Editor.app'), { recursive: true });

      vi.doMock('../../../../shared/utils/platform', () => ({
        isMac: true,
        getHomeDir: () => home,
      }));

      const { findAppBundle } = await import('../../../services/app-icon-service');

      try {
        expect(await findAppBundle(['Fake Editor.app'])).toBe(
          path.join(home, 'Applications', 'Fake Editor.app')
        );
      } finally {
        await rm(home, { recursive: true, force: true });
      }
    });

    it('tries every alternate bundle name before giving up', async () => {
      // PyCharm ships as "PyCharm.app" or "PyCharm Community Edition.app"; only
      // one of them is present on any given machine.
      const home = await mkdtemp(path.join(tmpdir(), 'barnacles-icon-home-'));
      await mkdir(path.join(home, 'Applications', 'PyCharm Community Edition.app'), {
        recursive: true,
      });

      vi.doMock('../../../../shared/utils/platform', () => ({
        isMac: true,
        getHomeDir: () => home,
      }));

      const { findAppBundle } = await import('../../../services/app-icon-service');

      try {
        expect(await findAppBundle(['PyCharm.app', 'PyCharm Community Edition.app'])).toBe(
          path.join(home, 'Applications', 'PyCharm Community Edition.app')
        );
      } finally {
        await rm(home, { recursive: true, force: true });
      }
    });

    it('returns null when no candidate exists anywhere', async () => {
      const home = await mkdtemp(path.join(tmpdir(), 'barnacles-icon-home-'));

      vi.doMock('../../../../shared/utils/platform', () => ({
        isMac: true,
        getHomeDir: () => home,
      }));

      const { findAppBundle } = await import('../../../services/app-icon-service');

      try {
        expect(await findAppBundle(['Definitely Not Installed.app'])).toBeNull();
      } finally {
        await rm(home, { recursive: true, force: true });
      }
    });
  });

  describe('getAppIconPng', () => {
    it('returns null off macOS without touching Electron', async () => {
      vi.doMock('../../../../shared/utils/platform', () => ({
        isMac: false,
        getHomeDir: () => '/home/someone',
      }));

      const { getAppIconPng } = await import('../../../services/app-icon-service');

      expect(await getAppIconPng('/Applications/Whatever.app')).toBeNull();
    });

    it('never calls getFileIcon, which crashes the process on macOS', async () => {
      // Regression guard. app.getFileIcon looks like the right API and is not:
      // on macOS it returns one generic document icon for every bundle, and
      // size:'large' aborts the process with SIGTRAP -- a native assertion no
      // try/catch can intercept. If someone reaches for it again, this fails.
      const source = await readFile(
        new URL('../../../services/app-icon-service.ts', import.meta.url),
        'utf-8'
      );

      // The comment explaining why it is avoided is welcome; a call is not.
      const withoutComments = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

      expect(withoutComments).not.toContain('getFileIcon');
    });

    it('returns null rather than throwing when the icon cannot be read', async () => {
      vi.doMock('../../../../shared/utils/platform', () => ({
        isMac: true,
        getHomeDir: () => '/home/someone',
      }));

      const { getAppIconPng } = await import('../../../services/app-icon-service');

      // No Electron app is running under vitest, so the import or the call
      // fails. A caller only ever needs to know "no icon".
      expect(await getAppIconPng('/Applications/Nonexistent.app')).toBeNull();
    });
  });
});
