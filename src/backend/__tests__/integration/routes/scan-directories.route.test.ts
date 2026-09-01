import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createIntegrationTestContext } from '@test/contexts';
import { get, post } from '@test/helpers/api-client';
import settings from '@backend/routes/settings';

// The settings route imports tray/CLI toggles from the Electron main process,
// which cannot load in the test environment.
vi.mock('../../../../main/main', () => ({
  toggleTrayIcon: vi.fn(),
  toggleCliInstallation: vi.fn(),
}));

interface ScanDirectoriesBody {
  data: { directories: string[]; added: string; alreadyPresent: boolean };
  message: string;
}

/** The test client parses JSON already; these just narrow the `unknown` payload. */
function bodyOf(response: { data: unknown }): ScanDirectoriesBody {
  return response.data as ScanDirectoriesBody;
}

function errorOf(response: { data: unknown }): string {
  return (response.data as { error: string }).error;
}

/**
 * Real directories, because the route stats the path before accepting it.
 * Created under the OS temp dir so nothing touches the user's actual tree.
 */
async function makeTempDir(name: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `barnacles-${name}-`));
  return dir;
}

describe('Scan Directories API Integration Tests', () => {
  const context = createIntegrationTestContext();
  const tempDirs: string[] = [];

  beforeEach(async () => {
    await context.setup(async () => {
      const { Hono } = await import('hono');
      const { errorHandler } = await import('@backend/middleware/error-handler');
      const app = new Hono();
      app.onError(errorHandler);
      app.route('/api/settings', settings);
      return app;
    });
  });

  afterEach(async () => {
    await context.teardown();
    await Promise.all(tempDirs.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true })));
  });

  describe('POST /api/settings/scan-directories', () => {
    it('appends a directory to the scan list', async () => {
      const { app } = context.get();
      const dir = await makeTempDir('clients');
      tempDirs.push(dir);

      const response = await post(app, '/api/settings/scan-directories', { path: dir });

      expect(response.status).toBe(200);
      const body = bodyOf(response);
      expect(body.data.alreadyPresent).toBe(false);
      expect(body.data.directories).toContain(body.data.added);

      // Re-read through the API to confirm it persisted, not just echoed back.
      const after = await get(app, '/api/settings/scanIncludedDirectories');
      const persisted: string[] = JSON.parse(
        (after.data as { data: { value: string } }).data.value
      );
      expect(persisted).toContain(body.data.added);
    });

    it('preserves the directories already configured', async () => {
      const { app } = context.get();
      const dir = await makeTempDir('preserve');
      tempDirs.push(dir);

      const before = await get(app, '/api/settings/scanIncludedDirectories');
      const existing: string[] = JSON.parse(
        (before.data as { data: { value: string } }).data.value
      );

      const response = await post(app, '/api/settings/scan-directories', { path: dir });
      const body = bodyOf(response);

      // Every prior entry survives the append — the whole point of doing the
      // read-modify-write server-side rather than in the client.
      for (const entry of existing) {
        expect(body.data.directories).toContain(entry);
      }
      expect(body.data.directories).toHaveLength(existing.length + 1);
    });

    it('is idempotent when the directory is already present', async () => {
      const { app } = context.get();
      const dir = await makeTempDir('twice');
      tempDirs.push(dir);

      const first = await post(app, '/api/settings/scan-directories', { path: dir });
      const firstBody = bodyOf(first);

      const second = await post(app, '/api/settings/scan-directories', { path: dir });
      const secondBody = bodyOf(second);

      expect(second.status).toBe(200);
      expect(secondBody.data.alreadyPresent).toBe(true);
      expect(secondBody.data.directories).toEqual(firstBody.data.directories);
    });

    it('stores home-relative paths in tilde form', async () => {
      const { app } = context.get();
      // A path under home that need not exist is no good — the route stats it.
      // Use the home directory's own temp-safe child: the OS temp dir on macOS
      // lives outside home, so build one explicitly.
      const dir = await fs.mkdtemp(path.join(os.homedir(), '.barnacles-test-'));
      tempDirs.push(dir);

      const response = await post(app, '/api/settings/scan-directories', { path: dir });
      const body = bodyOf(response);

      expect(body.data.added.startsWith('~')).toBe(true);
    });

    it('rejects the home directory as too broad', async () => {
      const { app } = context.get();

      const response = await post(app, '/api/settings/scan-directories', { path: os.homedir() });

      expect(response.status).toBe(422);
      expect(errorOf(response)).toMatch(/too broad/i);
    });

    it('rejects a filesystem root', async () => {
      const { app } = context.get();

      const response = await post(app, '/api/settings/scan-directories', {
        path: path.parse(os.homedir()).root,
      });

      expect(response.status).toBe(422);
      expect(errorOf(response)).toMatch(/filesystem root/i);
    });

    it('rejects a path that does not exist', async () => {
      const { app } = context.get();

      const response = await post(app, '/api/settings/scan-directories', {
        path: path.join(os.tmpdir(), 'barnacles-does-not-exist-xyz'),
      });

      expect(response.status).toBe(422);
      expect(errorOf(response)).toMatch(/does not exist/i);
    });

    it('rejects a file', async () => {
      const { app } = context.get();
      const dir = await makeTempDir('file');
      tempDirs.push(dir);
      const file = path.join(dir, 'not-a-dir.txt');
      await fs.writeFile(file, 'x');

      const response = await post(app, '/api/settings/scan-directories', { path: file });

      expect(response.status).toBe(422);
      expect(errorOf(response)).toMatch(/not a directory/i);
    });

    it('requires a path', async () => {
      const { app } = context.get();

      const response = await post(app, '/api/settings/scan-directories', {});

      expect(response.status).toBe(400);
    });
  });
});
