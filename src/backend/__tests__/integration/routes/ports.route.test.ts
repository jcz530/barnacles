import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createIntegrationTestContext } from '@test/contexts';
import { get, del } from '@test/helpers/api-client';
import ports from '@backend/routes/ports';
import * as cacheService from '@backend/services/port-screenshot-cache-service';

// Sample lsof output (macOS/Linux format)
const SAMPLE_LSOF_OUTPUT = `COMMAND   PID   USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node    12345   joe   28u  IPv4 0x1234      0t0  TCP *:3000 (LISTEN)
ruby    12346   joe   10u  IPv6 0x5678      0t0  TCP *:8080 (LISTEN)
python  12347   joe    5u  IPv4 0xabcd      0t0  TCP 127.0.0.1:5432 (LISTEN)`;

// Mutable per-test exec handler. Vitest hoists vi.mock() to module scope and
// only keeps the last factory registered for a given module path, so all
// child_process mocking must flow through this single indirection.
let execHandler: (
  cmd: string,
  callback: (err: Error | null, result?: { stdout: string }) => void
) => void;

vi.mock('child_process', async importOriginal => {
  const actual = await importOriginal<typeof import('child_process')>();
  return {
    ...actual,
    exec: vi.fn((cmd: string, callback: (err: Error | null, result?: { stdout: string }) => void) =>
      execHandler(cmd, callback)
    ),
  };
});

describe('Ports API Integration Tests', () => {
  const context = createIntegrationTestContext();

  beforeEach(async () => {
    execHandler = (_cmd, callback) => callback(null, { stdout: SAMPLE_LSOF_OUTPUT });

    await context.setup(async () => {
      const { Hono } = await import('hono');
      const { errorHandler } = await import('@backend/middleware/error-handler');
      const app = new Hono();
      app.onError(errorHandler);
      app.route('/api/ports', ports);
      return app;
    });
  });

  afterEach(async () => {
    await context.teardown();
    vi.restoreAllMocks();
  });

  describe('GET /api/ports', () => {
    it('should return port list parsed from lsof output', async () => {
      const { app } = context.get();

      // execHandler defaults to SAMPLE_LSOF_OUTPUT in beforeEach

      const response = await get(app, '/api/ports');

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('data');
      const data = (response.data as any).data;
      expect(Array.isArray(data)).toBe(true);
    });

    it('should return empty array when no ports found', async () => {
      const { app } = context.get();

      execHandler = (_cmd, callback) =>
        callback(null, { stdout: 'COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME\n' });

      const response = await get(app, '/api/ports');

      expect(response.status).toBe(200);
      const data = (response.data as any).data;
      expect(data).toEqual([]);
    });

    it('should return empty array when lsof is not available', async () => {
      const { app } = context.get();

      execHandler = (_cmd, callback) => callback(new Error('lsof: command not found'));

      const response = await get(app, '/api/ports');

      expect(response.status).toBe(200);
      const data = (response.data as any).data;
      expect(data).toEqual([]);
    });

    it('should include startedAt and command from ps output', async () => {
      const { app } = context.get();

      execHandler = (cmd, callback) => {
        if (cmd.startsWith('ps ')) {
          callback(null, {
            stdout:
              '12345 Fri Jun 19 12:31:37 2026 node server.js --port 3000\n' +
              '12346 Fri Jun 19 09:00:00 2026 ruby app.rb\n' +
              '12347 Fri Jun 19 08:00:00 2026 python manage.py runserver',
          });
          return;
        }
        callback(null, { stdout: SAMPLE_LSOF_OUTPUT });
      };

      const response = await get(app, '/api/ports');

      expect(response.status).toBe(200);
      const data = (response.data as any).data;
      const node = data.find((p: any) => p.pid === 12345);
      expect(node.command).toBe('node server.js --port 3000');
      expect(node.startedAt).toBe(new Date('Fri Jun 19 12:31:37 2026').toISOString());
    });
  });

  describe('GET /api/ports/screenshot/:fileName', () => {
    it('returns 400 for a file name that does not match the expected pattern', async () => {
      const { app } = context.get();

      const response = await get(app, '/api/ports/screenshot/not-a-valid-name.png');

      expect(response.status).toBe(400);
      expect((response.data as any).error).toBe('Invalid file name');
    });

    it('returns 404 when no cached screenshot exists for that file name', async () => {
      const { app } = context.get();
      vi.spyOn(cacheService, 'getByFileName').mockResolvedValue(null);

      const response = await get(app, '/api/ports/screenshot/abc123.jpg');

      expect(response.status).toBe(404);
      expect((response.data as any).error).toBe('Screenshot not found');
    });

    it('streams the cached JPEG with an immutable cache header when found', async () => {
      const { app } = context.get();
      const jpegBytes = Buffer.from('fake-jpeg-bytes');
      vi.spyOn(cacheService, 'getByFileName').mockResolvedValue(jpegBytes);

      const response = await app.fetch(
        new Request('http://localhost/api/ports/screenshot/abc123.jpg')
      );

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('image/jpeg');
      expect(response.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');

      const body = Buffer.from(await response.arrayBuffer());
      expect(body.equals(jpegBytes)).toBe(true);
    });
  });

  describe('DELETE /api/ports/:pid', () => {
    it('should kill a process by PID', async () => {
      const { app } = context.get();
      const killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);

      const response = await del(app, '/api/ports/12345');

      expect(response.status).toBe(200);
      expect(killSpy).toHaveBeenCalledWith(12345, 'SIGTERM');
      expect((response.data as any).message).toBe('Process killed');
    });

    it('should return 400 for non-numeric PID', async () => {
      const { app } = context.get();

      const response = await del(app, '/api/ports/notapid');

      expect(response.status).toBe(400);
      expect((response.data as any).error).toBe('Invalid PID');
    });

    it('should return 404 when process does not exist', async () => {
      const { app } = context.get();
      vi.spyOn(process, 'kill').mockImplementation(() => {
        const err = new Error('No such process') as NodeJS.ErrnoException;
        err.code = 'ESRCH';
        throw err;
      });

      const response = await del(app, '/api/ports/99999');

      expect(response.status).toBe(404);
      expect((response.data as any).error).toBe('Process not found');
    });

    it('should return 500 when kill fails for other reasons', async () => {
      const { app } = context.get();
      vi.spyOn(process, 'kill').mockImplementation(() => {
        const err = new Error('Operation not permitted') as NodeJS.ErrnoException;
        err.code = 'EPERM';
        throw err;
      });

      const response = await del(app, '/api/ports/12345');

      expect(response.status).toBe(500);
      expect((response.data as any).error).toBe('Failed to kill process');
    });
  });
});
