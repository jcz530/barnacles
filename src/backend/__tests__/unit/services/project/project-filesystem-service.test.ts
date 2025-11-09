import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUnitTestContext } from '@test/contexts';
import { projectFileSystemService } from '@backend/services/project/project-filesystem-service';
import { projectScannerService } from '@backend/services/project-scanner-service';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// Mock file system
vi.mock('fs/promises');

// Mock project scanner service
vi.mock('@backend/services/project-scanner-service', () => ({
  projectScannerService: {
    getThirdPartySizeByPath: vi.fn(),
  },
}));

describe('ProjectFileSystemService', () => {
  const context = createUnitTestContext();
  let tempDir: string;

  beforeEach(async () => {
    await context.setup();
    vi.clearAllMocks();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'project-fs-test-'));
  });

  afterEach(async () => {
    await context.teardown();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('getProjectReadme', () => {
    it('should return README.md content when it exists', async () => {
      const projectPath = '/test/project';
      const readmeContent = '# Test Project\n\nThis is a test project.';

      vi.mocked(fs.readFile).mockResolvedValue(readmeContent);

      const result = await projectFileSystemService.getProjectReadme(projectPath);

      expect(result).toBe(readmeContent);
      expect(fs.readFile).toHaveBeenCalledWith(path.join(projectPath, 'README.md'), 'utf-8');
    });

    it('should try different README filename variations', async () => {
      const projectPath = '/test/project';
      const readmeContent = '# Test';

      // First call fails (README.md)
      // Second call fails (readme.md)
      // Third call succeeds (Readme.md)
      vi.mocked(fs.readFile)
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockResolvedValueOnce(readmeContent);

      const result = await projectFileSystemService.getProjectReadme(projectPath);

      expect(result).toBe(readmeContent);
      expect(fs.readFile).toHaveBeenCalledTimes(3);
    });

    it('should return null when no README file exists', async () => {
      const projectPath = '/test/project';

      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      const result = await projectFileSystemService.getProjectReadme(projectPath);

      expect(result).toBeNull();
      expect(fs.readFile).toHaveBeenCalledTimes(4); // Tries all 4 variations
    });

    it('should try all README variations in correct order', async () => {
      const projectPath = '/test/project';

      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      await projectFileSystemService.getProjectReadme(projectPath);

      expect(fs.readFile).toHaveBeenNthCalledWith(1, path.join(projectPath, 'README.md'), 'utf-8');
      expect(fs.readFile).toHaveBeenNthCalledWith(2, path.join(projectPath, 'readme.md'), 'utf-8');
      expect(fs.readFile).toHaveBeenNthCalledWith(3, path.join(projectPath, 'Readme.md'), 'utf-8');
      expect(fs.readFile).toHaveBeenNthCalledWith(4, path.join(projectPath, 'README.MD'), 'utf-8');
    });
  });

  describe('deleteThirdPartyPackages', () => {
    it('should delete node_modules and return size', async () => {
      const projectPath = '/test/project';
      const thirdPartySize = 1024000;

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.rm).mockResolvedValue(undefined);
      vi.mocked(projectScannerService.getThirdPartySizeByPath).mockResolvedValue(thirdPartySize);

      const result = await projectFileSystemService.deleteThirdPartyPackages(projectPath);

      expect(result.deletedSize).toBe(thirdPartySize);
      expect(fs.access).toHaveBeenCalledWith(path.join(projectPath, 'node_modules'));
      expect(fs.rm).toHaveBeenCalledWith(path.join(projectPath, 'node_modules'), {
        recursive: true,
        force: true,
      });
    });

    it('should try to delete multiple third-party directories', async () => {
      const projectPath = '/test/project';

      // node_modules exists, others don't
      vi.mocked(fs.access)
        .mockResolvedValueOnce(undefined) // node_modules exists
        .mockRejectedValue(new Error('ENOENT')); // others don't exist

      vi.mocked(fs.rm).mockResolvedValue(undefined);
      vi.mocked(projectScannerService.getThirdPartySizeByPath).mockResolvedValue(1000);

      await projectFileSystemService.deleteThirdPartyPackages(projectPath);

      // Should check all third-party directories
      expect(fs.access).toHaveBeenCalledWith(path.join(projectPath, 'node_modules'));
      expect(fs.access).toHaveBeenCalledWith(path.join(projectPath, 'vendor'));
      expect(fs.access).toHaveBeenCalledWith(path.join(projectPath, '.venv'));
      expect(fs.access).toHaveBeenCalledWith(path.join(projectPath, 'venv'));
      expect(fs.access).toHaveBeenCalledWith(path.join(projectPath, 'target/debug'));
      expect(fs.access).toHaveBeenCalledWith(path.join(projectPath, 'target/release'));

      // Should only delete the one that exists
      expect(fs.rm).toHaveBeenCalledTimes(1);
    });

    it('should return 0 when no third-party directories exist', async () => {
      const projectPath = '/test/project';

      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      const result = await projectFileSystemService.deleteThirdPartyPackages(projectPath);

      expect(result.deletedSize).toBe(0);
      expect(fs.rm).not.toHaveBeenCalled();
    });

    it('should handle deletion errors gracefully', async () => {
      const projectPath = '/test/project';

      vi.mocked(fs.access).mockResolvedValue(undefined);
      vi.mocked(fs.rm).mockRejectedValue(new Error('Permission denied'));
      vi.mocked(projectScannerService.getThirdPartySizeByPath).mockResolvedValue(1000);

      const result = await projectFileSystemService.deleteThirdPartyPackages(projectPath);

      // Should not throw, just return 0
      expect(result.deletedSize).toBe(0);
    });

    it('should delete vendor directory for PHP projects', async () => {
      const projectPath = '/test/php-project';
      const vendorSize = 500000;

      // Only vendor exists
      vi.mocked(fs.access).mockImplementation(async (filePath: any) => {
        if (filePath.includes('vendor')) {
          return Promise.resolve(undefined);
        }
        throw new Error('ENOENT');
      });

      vi.mocked(fs.rm).mockResolvedValue(undefined);
      vi.mocked(projectScannerService.getThirdPartySizeByPath).mockResolvedValue(vendorSize);

      const result = await projectFileSystemService.deleteThirdPartyPackages(projectPath);

      expect(result.deletedSize).toBe(vendorSize);
      expect(fs.rm).toHaveBeenCalledWith(path.join(projectPath, 'vendor'), {
        recursive: true,
        force: true,
      });
    });

    it('should delete Python virtual environments', async () => {
      const projectPath = '/test/python-project';

      vi.mocked(fs.access).mockImplementation(async (filePath: any) => {
        if (filePath.includes('.venv') || filePath.includes('venv')) {
          return Promise.resolve(undefined);
        }
        throw new Error('ENOENT');
      });

      vi.mocked(fs.rm).mockResolvedValue(undefined);
      vi.mocked(projectScannerService.getThirdPartySizeByPath).mockResolvedValue(2000);

      await projectFileSystemService.deleteThirdPartyPackages(projectPath);

      expect(fs.rm).toHaveBeenCalledWith(path.join(projectPath, '.venv'), {
        recursive: true,
        force: true,
      });
    });

    it('should delete Rust target directories', async () => {
      const projectPath = '/test/rust-project';

      vi.mocked(fs.access).mockImplementation(async (filePath: any) => {
        if (filePath.includes('target/debug') || filePath.includes('target/release')) {
          return Promise.resolve(undefined);
        }
        throw new Error('ENOENT');
      });

      vi.mocked(fs.rm).mockResolvedValue(undefined);
      vi.mocked(projectScannerService.getThirdPartySizeByPath).mockResolvedValue(3000);

      await projectFileSystemService.deleteThirdPartyPackages(projectPath);

      expect(fs.rm).toHaveBeenCalledWith(path.join(projectPath, 'target/debug'), {
        recursive: true,
        force: true,
      });
    });
  });
});
