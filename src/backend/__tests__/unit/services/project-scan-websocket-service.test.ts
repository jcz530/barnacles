import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createUnitTestContext, mockDatabaseForUnit } from '@test/contexts';
import {
  ProjectScanWebSocketService,
  type ScanProgress,
} from '@backend/services/project-scan-websocket-service';
import type { ProjectInfo } from '@backend/services/project-scanner-service';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

mockDatabaseForUnit();

/**
 * Reaches the private walk. It is the single scan implementation, so it is worth
 * testing directly rather than only through the WebSocket message plumbing.
 */
type WalkAccess = {
  scanDirectoriesIncremental(
    basePaths: string[],
    maxDepth: number,
    onProjectDiscovered: (info: ProjectInfo) => Promise<void>,
    scanId: string
  ): Promise<void>;
  activeScans: Map<string, { cancelled: boolean; totalDiscovered: number }>;
};

describe('ProjectScanWebSocketService walk', () => {
  const context = createUnitTestContext();
  let tempDir: string;
  let service: ProjectScanWebSocketService;
  let walk: WalkAccess;

  beforeEach(async () => {
    await context.setup();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scan-walk-test-'));
    service = new ProjectScanWebSocketService();
    walk = service as unknown as WalkAccess;
  });

  afterEach(async () => {
    await context.teardown();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  /** Creates a directory that isValidProject() will accept. */
  async function makeProject(name: string): Promise<string> {
    const dir = path.join(tempDir, name);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify({ name }));
    return dir;
  }

  async function runScan(scanId = 'test-scan'): Promise<string[]> {
    const found: string[] = [];
    walk.activeScans.set(scanId, { cancelled: false, totalDiscovered: 0 });
    try {
      await walk.scanDirectoriesIncremental(
        [tempDir],
        3,
        async info => {
          found.push(info.path);
        },
        scanId
      );
    } finally {
      walk.activeScans.delete(scanId);
    }
    return found;
  }

  it('discovers every sibling project when walking concurrently', async () => {
    // More projects than SCAN_CONCURRENCY (8), so the worker pool has to loop.
    const names = Array.from({ length: 20 }, (_, i) => `proj-${i}`);
    for (const name of names) {
      await makeProject(name);
    }

    const found = await runScan();

    expect(found).toHaveLength(20);
    expect(new Set(found.map(p => path.basename(p)))).toEqual(new Set(names));
  });

  it('does not emit the same project twice', async () => {
    for (let i = 0; i < 12; i++) {
      await makeProject(`dup-${i}`);
    }

    const found = await runScan();

    expect(new Set(found).size).toBe(found.length);
  });

  it('stops early once the scan is cancelled', async () => {
    for (let i = 0; i < 20; i++) {
      await makeProject(`cancel-${i}`);
    }

    const scanId = 'cancel-scan';
    const found: string[] = [];
    walk.activeScans.set(scanId, { cancelled: false, totalDiscovered: 0 });

    await walk.scanDirectoriesIncremental(
      [tempDir],
      3,
      async info => {
        found.push(info.path);
        // Cancel as soon as the first project is emitted
        const state = walk.activeScans.get(scanId);
        if (state) {
          state.cancelled = true;
        }
      },
      scanId
    );
    walk.activeScans.delete(scanId);

    // Cancelling on the first emit stops the walk almost immediately: the eight
    // workers already in flight finish their current subtree, then every further
    // subdirectory short-circuits at the top of scanRecursive. So one batch
    // lands, not all 20.
    expect(found.length).toBeGreaterThan(0);
    expect(found.length).toBeLessThanOrEqual(8);
  });

  it('stops at the first project rather than descending into it', async () => {
    const outer = await makeProject('outer');
    // A nested project inside an already-matched project must not be emitted.
    const inner = path.join(outer, 'packages', 'inner');
    await fs.mkdir(inner, { recursive: true });
    await fs.writeFile(path.join(inner, 'package.json'), JSON.stringify({ name: 'inner' }));

    const found = await runScan();

    expect(found).toEqual([outer]);
  });

  it('ignores dot-directories', async () => {
    const hidden = path.join(tempDir, '.hidden-proj');
    await fs.mkdir(hidden, { recursive: true });
    await fs.writeFile(path.join(hidden, 'package.json'), '{}');
    await makeProject('visible');

    const found = await runScan();

    expect(found.map(p => path.basename(p))).toEqual(['visible']);
  });
});

// Keeps the ScanProgress import meaningful for type-checking consumers.
export type { ScanProgress };
