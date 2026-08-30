import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createUnitTestContext, mockDatabaseForUnit } from '@test/contexts';
import { projectScannerService } from '@backend/services/project-scanner-service';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// getProjectStats reads the scanExcludedDirectories setting
mockDatabaseForUnit();

describe('ProjectScannerService', () => {
  const context = createUnitTestContext();
  let tempDir: string;

  beforeEach(async () => {
    await context.setup();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scanner-test-'));
  });

  afterEach(async () => {
    await context.teardown();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('getProjectStats line counting', () => {
    it('should not count lines in binary files', async () => {
      // A text file with a known line count
      await fs.writeFile(path.join(tempDir, 'app.ts'), 'a\nb\nc\n');

      // A "binary" file whose bytes contain many newlines. If it were read as
      // UTF-8 and split, it would add thousands of bogus lines.
      const binary = Buffer.alloc(4096, 0x0a);
      await fs.writeFile(path.join(tempDir, 'image.png'), binary);
      await fs.writeFile(path.join(tempDir, 'archive.zip'), binary);

      const { stats } = await projectScannerService.getProjectStats(tempDir);

      // 'a\nb\nc\n'.split('\n') === ['a','b','c',''] -> 4
      expect(stats.linesOfCode).toBe(4);
      // The binaries are still counted as files, just not line-counted
      expect(stats.fileCount).toBe(3);
    });

    it('should not count lines in files over the size cap', async () => {
      await fs.writeFile(path.join(tempDir, 'small.ts'), 'x\n');

      // 3 MB of newlines, over the 2 MB cap
      const huge = Buffer.alloc(3 * 1024 * 1024, 0x0a);
      await fs.writeFile(path.join(tempDir, 'huge.ts'), huge);

      const { stats } = await projectScannerService.getProjectStats(tempDir);

      // Only small.ts contributes: 'x\n'.split('\n') === ['x',''] -> 2
      expect(stats.linesOfCode).toBe(2);
      expect(stats.fileCount).toBe(2);
    });

    it('should still count lines in ordinary text files', async () => {
      await fs.writeFile(path.join(tempDir, 'a.ts'), 'one\ntwo\n');
      await fs.writeFile(path.join(tempDir, 'b.md'), '# title\n');
      await fs.writeFile(path.join(tempDir, 'c.json'), '{}\n');

      const { stats } = await projectScannerService.getProjectStats(tempDir);

      // 3 + 2 + 2
      expect(stats.linesOfCode).toBe(7);
      expect(stats.fileCount).toBe(3);
    });
  });
});
