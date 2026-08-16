import { describe, expect, it } from 'vitest';
import os from 'os';
import path from 'node:path';
import { getAppDataDir, getDatabasePath } from '@shared/database/paths';

/**
 * These tests are the regression guard against demo/screenshot data reaching the
 * user's real database. The critical property is the *ordering* inside
 * getDatabasePath: BARNACLES_DATA_DIR must win over NODE_ENV=development, which
 * otherwise resolves to ./database.db.
 */
describe('database paths', () => {
  const demoDir = path.join(os.tmpdir(), 'barnacles-paths-test', '.demo-data');

  describe('getDatabasePath', () => {
    it('uses an in-memory database under NODE_ENV=test', () => {
      expect(getDatabasePath({ NODE_ENV: 'test' })).toBe(':memory:');
    });

    it('uses an in-memory database under VITEST', () => {
      expect(getDatabasePath({ VITEST: 'true' })).toBe(':memory:');
    });

    it('uses ./database.db in development when no override is set', () => {
      expect(getDatabasePath({ NODE_ENV: 'development' })).toBe('./database.db');
    });

    it('lets BARNACLES_DATA_DIR override the development database', () => {
      const resolved = getDatabasePath({
        NODE_ENV: 'development',
        BARNACLES_DATA_DIR: demoDir,
      });

      expect(resolved).toBe(path.join(path.resolve(demoDir), 'database.db'));
      expect(resolved).not.toBe('./database.db');
    });

    it('never resolves to the real dev database when an override is set', () => {
      // The failure this guards: an implementation that checks NODE_ENV first
      // would return './database.db' here and seed fake data into real data.
      for (const nodeEnv of ['development', 'production', undefined]) {
        const resolved = getDatabasePath({
          ...(nodeEnv ? { NODE_ENV: nodeEnv } : {}),
          BARNACLES_DATA_DIR: demoDir,
        });
        expect(resolved).toContain('.demo-data');
      }
    });

    it('keeps test mode winning over an override', () => {
      expect(getDatabasePath({ NODE_ENV: 'test', BARNACLES_DATA_DIR: demoDir })).toBe(':memory:');
    });

    it('uses the app data dir in production', () => {
      const resolved = getDatabasePath({ NODE_ENV: 'production' });
      expect(resolved).toBe(path.join(getAppDataDir({ NODE_ENV: 'production' }), 'database.db'));
    });
  });

  describe('getAppDataDir', () => {
    it('honours BARNACLES_DATA_DIR so file-backed caches follow the profile', () => {
      expect(getAppDataDir({ BARNACLES_DATA_DIR: demoDir })).toBe(path.resolve(demoDir));
    });

    it('resolves relative overrides to an absolute path', () => {
      const resolved = getAppDataDir({ BARNACLES_DATA_DIR: '.demo-data' });
      expect(path.isAbsolute(resolved)).toBe(true);
    });

    it('falls back to the platform app data dir with no override', () => {
      const resolved = getAppDataDir({ NODE_ENV: 'production' });
      expect(resolved).toContain('Barnacles');
      expect(resolved).toContain(os.homedir());
    });
  });
});
