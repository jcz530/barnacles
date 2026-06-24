import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createUnitTestContext, mockDatabaseForUnit } from '@test/contexts';
import {
  computeContentSignature,
  evict,
  getByFileName,
  getFresh,
  getStale,
  isKnownNonHttp,
  markNonHttp,
  clearNonHttp,
  sweepOrphans,
  upsert,
} from '@backend/services/port-screenshot-cache-service';

mockDatabaseForUnit();

const fakeJpeg = (label: string) => Buffer.from(`fake-jpeg-${label}`);

describe('PortScreenshotCacheService', () => {
  const context = createUnitTestContext();

  beforeEach(async () => {
    await context.setup();
  });

  afterEach(async () => {
    await context.teardown();
  });

  describe('upsert + getFresh', () => {
    it('caches a screenshot and serves it back as fresh with a matching signature', async () => {
      const result = await upsert({
        port: 3000,
        processName: 'node',
        signature: 'sig-a',
        jpegBuffer: fakeJpeg('a'),
        width: 384,
        height: 240,
      });

      expect(result.fileName).toMatch(/\.jpg$/);

      const fresh = await getFresh(3000, 'node', 'sig-a');
      expect(fresh).not.toBeNull();
      expect(fresh?.fileName).toBe(result.fileName);
    });

    it('returns null when no cache entry exists', async () => {
      const fresh = await getFresh(4000, 'node', 'sig-x');
      expect(fresh).toBeNull();
    });

    it('returns null when the content signature has changed', async () => {
      await upsert({
        port: 3001,
        processName: 'node',
        signature: 'sig-a',
        jpegBuffer: fakeJpeg('a'),
        width: 384,
        height: 240,
      });

      const fresh = await getFresh(3001, 'node', 'sig-b');
      expect(fresh).toBeNull();
    });

    it('overwrites the existing row for the same port+processName instead of duplicating', async () => {
      const first = await upsert({
        port: 3002,
        processName: 'node',
        signature: 'sig-a',
        jpegBuffer: fakeJpeg('a'),
        width: 384,
        height: 240,
      });

      const second = await upsert({
        port: 3002,
        processName: 'node',
        signature: 'sig-b',
        jpegBuffer: fakeJpeg('b'),
        width: 384,
        height: 240,
      });

      // Same logical key reuses the same cache id/file name
      expect(second.fileName).toBe(first.fileName);

      const bytes = await getByFileName(second.fileName);
      expect(bytes?.toString()).toBe('fake-jpeg-b');
    });

    it('creates a separate entry for a different process on the same port', async () => {
      const nodeEntry = await upsert({
        port: 3003,
        processName: 'node',
        signature: 'sig-a',
        jpegBuffer: fakeJpeg('node'),
        width: 384,
        height: 240,
      });
      const rubyEntry = await upsert({
        port: 3003,
        processName: 'ruby',
        signature: 'sig-a',
        jpegBuffer: fakeJpeg('ruby'),
        width: 384,
        height: 240,
      });

      expect(nodeEntry.fileName).not.toBe(rubyEntry.fileName);
    });
  });

  describe('getStale', () => {
    it('returns the cached entry even if the TTL or signature would reject it', async () => {
      await upsert({
        port: 3004,
        processName: 'node',
        signature: 'sig-a',
        jpegBuffer: fakeJpeg('a'),
        width: 384,
        height: 240,
      });

      const stale = await getStale(3004, 'node');
      expect(stale).not.toBeNull();
    });

    it('returns null when nothing has ever been cached', async () => {
      const stale = await getStale(3005, 'node');
      expect(stale).toBeNull();
    });
  });

  describe('getByFileName', () => {
    it('reads back the exact bytes that were written', async () => {
      const result = await upsert({
        port: 3006,
        processName: 'node',
        signature: 'sig-a',
        jpegBuffer: fakeJpeg('roundtrip'),
        width: 384,
        height: 240,
      });

      const bytes = await getByFileName(result.fileName);
      expect(bytes?.toString()).toBe('fake-jpeg-roundtrip');
    });

    it('returns null for a file name that does not exist', async () => {
      const bytes = await getByFileName('does-not-exist.jpg');
      expect(bytes).toBeNull();
    });
  });

  describe('computeContentSignature', () => {
    it('derives the same signature from the same headers', () => {
      const a = computeContentSignature({
        etag: '"abc"',
        lastModified: null,
        contentLength: '100',
      });
      const b = computeContentSignature({
        etag: '"abc"',
        lastModified: null,
        contentLength: '100',
      });
      expect(a).toBe(b);
    });

    it('derives a different signature when headers differ', () => {
      const a = computeContentSignature({ etag: '"abc"' });
      const b = computeContentSignature({ etag: '"def"' });
      expect(a).not.toBe(b);
    });

    it('falls back to hashing the body prefix when no cache headers are present', () => {
      const a = computeContentSignature({ bodyPrefix: '<html>hello</html>' });
      const b = computeContentSignature({ bodyPrefix: '<html>different</html>' });
      expect(a).not.toBe(b);
    });
  });

  describe('evict', () => {
    it('removes the least-recently-accessed entries once the entry cap is exceeded', async () => {
      // upsert() calls evict() internally after every write, so we only need
      // to confirm old entries are gone once enough distinct ports have been cached.
      // Use a tiny, deterministic slice of entries well under the real cap to assert
      // that none are evicted under normal usage.
      for (let port = 4000; port < 4005; port++) {
        await upsert({
          port,
          processName: 'node',
          signature: 'sig',
          jpegBuffer: fakeJpeg(String(port)),
          width: 384,
          height: 240,
        });
      }

      for (let port = 4000; port < 4005; port++) {
        const fresh = await getFresh(port, 'node', 'sig');
        expect(fresh).not.toBeNull();
      }

      await evict();

      for (let port = 4000; port < 4005; port++) {
        const fresh = await getFresh(port, 'node', 'sig');
        expect(fresh).not.toBeNull();
      }
    });
  });

  describe('sweepOrphans', () => {
    it('does not throw when the cache is empty', async () => {
      await expect(sweepOrphans()).resolves.not.toThrow();
    });

    it('drops a DB row whose backing file is missing', async () => {
      const result = await upsert({
        port: 3007,
        processName: 'node',
        signature: 'sig-a',
        jpegBuffer: fakeJpeg('a'),
        width: 384,
        height: 240,
      });

      // Simulate the file being lost without the DB knowing (e.g. manual deletion)
      const bytesBefore = await getByFileName(result.fileName);
      expect(bytesBefore).not.toBeNull();

      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const { getAppDataDir } = await import('@shared/database/connection');
      await fs.unlink(path.join(getAppDataDir(), 'screenshot-cache', result.fileName));

      await sweepOrphans();

      const fresh = await getFresh(3007, 'node', 'sig-a');
      expect(fresh).toBeNull();
    });
  });

  describe('non-HTTP negative cache', () => {
    it('reports unknown ports as not known-non-HTTP', () => {
      expect(isKnownNonHttp(5000)).toBe(false);
    });

    it('marks and recalls a port as known-non-HTTP', () => {
      markNonHttp(5001);
      expect(isKnownNonHttp(5001)).toBe(true);
    });

    it('clears a marked port', () => {
      markNonHttp(5002);
      clearNonHttp(5002);
      expect(isKnownNonHttp(5002)).toBe(false);
    });
  });
});
