import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createUnitTestContext } from '@test/contexts';
import { projectPackageService } from '@backend/services/project/project-package-service';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock file system
vi.mock('fs/promises');

describe('ProjectPackageService', () => {
  const context = createUnitTestContext();

  beforeEach(async () => {
    await context.setup();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await context.teardown();
  });

  describe('getPackageScripts', () => {
    it('should return scripts from package.json', async () => {
      const projectPath = '/test/project';
      const packageJson = {
        name: 'test-project',
        scripts: {
          dev: 'vite',
          build: 'vite build',
          test: 'vitest',
          lint: 'eslint src',
        },
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(packageJson));

      const result = await projectPackageService.getPackageScripts(projectPath);

      expect(result).toEqual({
        dev: 'vite',
        build: 'vite build',
        test: 'vitest',
        lint: 'eslint src',
      });
      expect(fs.readFile).toHaveBeenCalledWith(path.join(projectPath, 'package.json'), 'utf-8');
    });

    it('should return empty object when package.json has no scripts', async () => {
      const projectPath = '/test/project';
      const packageJson = {
        name: 'test-project',
        dependencies: {},
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(packageJson));

      const result = await projectPackageService.getPackageScripts(projectPath);

      expect(result).toEqual({});
    });

    it('should return empty object when package.json does not exist', async () => {
      const projectPath = '/test/project';

      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      const result = await projectPackageService.getPackageScripts(projectPath);

      expect(result).toEqual({});
    });

    it('should return empty object when package.json is invalid JSON', async () => {
      const projectPath = '/test/project';

      vi.mocked(fs.readFile).mockResolvedValue('{ invalid json }');

      const result = await projectPackageService.getPackageScripts(projectPath);

      expect(result).toEqual({});
    });

    it('should handle package.json with empty scripts object', async () => {
      const projectPath = '/test/project';
      const packageJson = {
        name: 'test-project',
        scripts: {},
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(packageJson));

      const result = await projectPackageService.getPackageScripts(projectPath);

      expect(result).toEqual({});
    });
  });

  describe('getComposerScripts', () => {
    it('should return scripts from composer.json', async () => {
      const projectPath = '/test/project';
      const composerJson = {
        name: 'test/project',
        scripts: {
          test: 'phpunit',
          'cs-fix': 'php-cs-fixer fix',
          analyze: 'phpstan analyse',
        },
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(composerJson));

      const result = await projectPackageService.getComposerScripts(projectPath);

      expect(result).toEqual({
        test: 'phpunit',
        'cs-fix': 'php-cs-fixer fix',
        analyze: 'phpstan analyse',
      });
      expect(fs.readFile).toHaveBeenCalledWith(path.join(projectPath, 'composer.json'), 'utf-8');
    });

    it('should return empty object when composer.json has no scripts', async () => {
      const projectPath = '/test/project';
      const composerJson = {
        name: 'test/project',
        require: {},
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(composerJson));

      const result = await projectPackageService.getComposerScripts(projectPath);

      expect(result).toEqual({});
    });

    it('should return empty object when composer.json does not exist', async () => {
      const projectPath = '/test/project';

      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      const result = await projectPackageService.getComposerScripts(projectPath);

      expect(result).toEqual({});
    });

    it('should return empty object when composer.json is invalid JSON', async () => {
      const projectPath = '/test/project';

      vi.mocked(fs.readFile).mockResolvedValue('not valid json');

      const result = await projectPackageService.getComposerScripts(projectPath);

      expect(result).toEqual({});
    });
  });

  describe('detectPackageManager', () => {
    it('should detect pnpm when pnpm-lock.yaml exists', async () => {
      const projectPath = '/test/project';

      vi.mocked(fs.access).mockResolvedValue(undefined);

      const result = await projectPackageService.detectPackageManager(projectPath);

      expect(result).toBe('pnpm');
      expect(fs.access).toHaveBeenCalledWith(path.join(projectPath, 'pnpm-lock.yaml'));
    });

    it('should detect yarn when yarn.lock exists and pnpm-lock does not', async () => {
      const projectPath = '/test/project';

      vi.mocked(fs.access)
        .mockRejectedValueOnce(new Error('ENOENT')) // pnpm-lock.yaml doesn't exist
        .mockResolvedValueOnce(undefined); // yarn.lock exists

      const result = await projectPackageService.detectPackageManager(projectPath);

      expect(result).toBe('yarn');
      expect(fs.access).toHaveBeenCalledWith(path.join(projectPath, 'yarn.lock'));
    });

    it('should default to npm when no lock files exist', async () => {
      const projectPath = '/test/project';

      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      const result = await projectPackageService.detectPackageManager(projectPath);

      expect(result).toBe('npm');
    });

    it('should check lock files in correct priority order', async () => {
      const projectPath = '/test/project';

      vi.mocked(fs.access).mockRejectedValue(new Error('ENOENT'));

      await projectPackageService.detectPackageManager(projectPath);

      // Should check pnpm first, then yarn
      expect(fs.access).toHaveBeenNthCalledWith(1, path.join(projectPath, 'pnpm-lock.yaml'));
      expect(fs.access).toHaveBeenNthCalledWith(2, path.join(projectPath, 'yarn.lock'));
    });

    it('should default to npm on file system errors', async () => {
      const projectPath = '/test/project';

      vi.mocked(fs.access).mockRejectedValue(new Error('Permission denied'));

      const result = await projectPackageService.detectPackageManager(projectPath);

      expect(result).toBe('npm');
    });

    it('should detect pnpm even if yarn.lock also exists', async () => {
      const projectPath = '/test/project';

      // pnpm-lock.yaml exists (first check succeeds)
      vi.mocked(fs.access).mockResolvedValueOnce(undefined);

      const result = await projectPackageService.detectPackageManager(projectPath);

      expect(result).toBe('pnpm');
      // Should not check for yarn.lock since pnpm was found first
      expect(fs.access).toHaveBeenCalledTimes(1);
    });

    it('should handle access returning false for pnpm-lock', async () => {
      const projectPath = '/test/project';

      vi.mocked(fs.access).mockImplementation(async (filePath: any) => {
        if (filePath.includes('yarn.lock')) {
          return Promise.resolve(undefined);
        }
        throw new Error('ENOENT');
      });

      const result = await projectPackageService.detectPackageManager(projectPath);

      expect(result).toBe('yarn');
    });
  });
});
