import { describe, expect, it } from 'vitest';
import path from 'node:path';
import {
  isDemoMode,
  isDemoModeMisconfigured,
  isDemoProfilePath,
  isScreenshotMode,
} from '@shared/config/runtime-mode';

/**
 * Demo mode changes what the UI displays — username, git stats, running
 * processes, alias paths — not just what gets seeded. These tests pin the rule
 * that it requires a demo profile, so the flag alone can never dress up the
 * user's real data as demo data.
 */
describe('runtime mode', () => {
  const profile = '/tmp/barnacles-demo/.demo-data';

  describe('isDemoMode', () => {
    it('is on with both the flag and a demo profile', () => {
      expect(isDemoMode({ BARNACLES_DEMO: '1', BARNACLES_DATA_DIR: profile })).toBe(true);
    });

    it('is off with the flag but no profile', () => {
      expect(isDemoMode({ BARNACLES_DEMO: '1' })).toBe(false);
    });

    it('is off with a profile but no flag', () => {
      expect(isDemoMode({ BARNACLES_DATA_DIR: profile })).toBe(false);
    });

    it('is off in a normal session', () => {
      expect(isDemoMode({ NODE_ENV: 'development' })).toBe(false);
      expect(isDemoMode({})).toBe(false);
    });

    it('only accepts an exact "1" flag', () => {
      for (const value of ['0', 'true', 'yes', 'TRUE', '']) {
        expect(isDemoMode({ BARNACLES_DEMO: value, BARNACLES_DATA_DIR: profile })).toBe(false);
      }
    });
  });

  describe('isDemoProfilePath', () => {
    it('matches a whole path component', () => {
      expect(isDemoProfilePath(profile)).toBe(true);
      expect(isDemoProfilePath(path.join(profile, 'nested'))).toBe(true);
    });

    it('rejects a lookalike directory name', () => {
      // Substring matching would wrongly accept these.
      expect(isDemoProfilePath('/Users/dev/my.demo-database')).toBe(false);
      expect(isDemoProfilePath('/Users/dev/.demo-data-backup')).toBe(false);
      expect(isDemoProfilePath('/Users/dev/prefix.demo-data-suffix')).toBe(false);
    });

    it('rejects an unset or empty value', () => {
      expect(isDemoProfilePath(undefined)).toBe(false);
      expect(isDemoProfilePath('')).toBe(false);
    });

    it('resolves relative paths before matching', () => {
      expect(isDemoProfilePath('.demo-data')).toBe(true);
    });
  });

  describe('isDemoModeMisconfigured', () => {
    it('flags the flag-without-profile case so startup can fail loudly', () => {
      expect(isDemoModeMisconfigured({ BARNACLES_DEMO: '1' })).toBe(true);
      expect(isDemoModeMisconfigured({ BARNACLES_DEMO: '1', BARNACLES_DATA_DIR: '/tmp/x' })).toBe(
        true
      );
    });

    it('is quiet for a correct demo run and for a normal session', () => {
      expect(isDemoModeMisconfigured({ BARNACLES_DEMO: '1', BARNACLES_DATA_DIR: profile })).toBe(
        false
      );
      expect(isDemoModeMisconfigured({})).toBe(false);
    });
  });

  describe('isScreenshotMode', () => {
    it('reads its own flag', () => {
      expect(isScreenshotMode({ BARNACLES_SCREENSHOTS: '1' })).toBe(true);
      expect(isScreenshotMode({})).toBe(false);
    });
  });
});
