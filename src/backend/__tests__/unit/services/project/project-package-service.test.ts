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

  describe('getPackageScriptGroups', () => {
    const makeDirent = (name: string) => ({
      name,
      isDirectory: () => true,
    });

    it('should return only the root group for a non-monorepo project', async () => {
      const projectPath = '/test/project';
      const packageJson = { scripts: { dev: 'vite', build: 'vite build' } };

      vi.mocked(fs.readdir).mockResolvedValue([] as any);
      vi.mocked(fs.readFile).mockImplementation(async filePath => {
        if (filePath === path.join(projectPath, 'package.json')) {
          return JSON.stringify(packageJson);
        }
        throw new Error('ENOENT');
      });

      const result = await projectPackageService.getPackageScriptGroups(projectPath);

      expect(result).toEqual([{ relativeDir: '', scripts: packageJson.scripts }]);
    });

    it('should detect scripts in immediate subdirectories for monorepo layouts', async () => {
      const projectPath = '/test/monorepo';
      const frontendScripts = { dev: 'vite', build: 'vite build' };
      const backendScripts = { dev: 'nodemon src/index.js', test: 'jest' };

      vi.mocked(fs.readdir).mockResolvedValue([
        makeDirent('frontend'),
        makeDirent('backend'),
      ] as any);
      vi.mocked(fs.readFile).mockImplementation(async filePath => {
        if (filePath === path.join(projectPath, 'frontend', 'package.json')) {
          return JSON.stringify({ scripts: frontendScripts });
        }
        if (filePath === path.join(projectPath, 'backend', 'package.json')) {
          return JSON.stringify({ scripts: backendScripts });
        }
        throw new Error('ENOENT');
      });

      const result = await projectPackageService.getPackageScriptGroups(projectPath);

      expect(result).toEqual([
        { relativeDir: 'frontend', scripts: frontendScripts },
        { relativeDir: 'backend', scripts: backendScripts },
      ]);
    });

    it('should skip ignored directories like node_modules and .git', async () => {
      const projectPath = '/test/project';

      vi.mocked(fs.readdir).mockResolvedValue([
        makeDirent('node_modules'),
        makeDirent('.git'),
        makeDirent('dist'),
      ] as any);
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      const result = await projectPackageService.getPackageScriptGroups(projectPath);

      expect(result).toEqual([]);
      expect(fs.readFile).not.toHaveBeenCalledWith(
        path.join(projectPath, 'node_modules', 'package.json'),
        'utf-8'
      );
    });

    it('should omit subdirectories with no scripts', async () => {
      const projectPath = '/test/project';

      vi.mocked(fs.readdir).mockResolvedValue([makeDirent('docs')] as any);
      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));

      const result = await projectPackageService.getPackageScriptGroups(projectPath);

      expect(result).toEqual([]);
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

    it('should detect the package manager within a subdirectory when subPath is provided', async () => {
      const projectPath = '/test/monorepo';

      vi.mocked(fs.access).mockResolvedValue(undefined);

      const result = await projectPackageService.detectPackageManager(projectPath, 'backend');

      expect(result).toBe('pnpm');
      expect(fs.access).toHaveBeenCalledWith(path.join(projectPath, 'backend', 'pnpm-lock.yaml'));
    });
  });
  describe('getRunnableScripts', () => {
    const dirent = (name: string) => ({ name, isDirectory: () => true });

    /** Route reads and lock-file probes for a whole fake project in one go. */
    const mockProject = (
      files: Record<string, unknown>,
      subdirs: string[] = [],
      locks: string[] = []
    ) => {
      vi.mocked(fs.readdir).mockResolvedValue(subdirs.map(dirent) as never);
      vi.mocked(fs.readFile).mockImplementation(async filePath => {
        const found = files[filePath as string];
        if (!found) throw new Error('ENOENT');
        return JSON.stringify(found);
      });
      vi.mocked(fs.access).mockImplementation(async filePath =>
        locks.includes(filePath as string) ? undefined : Promise.reject(new Error('ENOENT'))
      );
    };

    it('resolves the package manager per directory, not once for the project', async () => {
      // The reason this lives on the server. A monorepo root and a workspace can
      // use different managers, and a client resolving that per subdirectory
      // shows the wrong command until each reply lands -- one keystroke from
      // running it.
      const projectPath = '/test/monorepo';
      mockProject(
        {
          [path.join(projectPath, 'package.json')]: { scripts: { build: 'turbo build' } },
          [path.join(projectPath, 'api', 'package.json')]: { scripts: { build: 'tsc' } },
        },
        ['api'],
        // pnpm at the root, nothing in api/ -- so api/ falls back to npm.
        [path.join(projectPath, 'pnpm-lock.yaml')]
      );

      const result = await projectPackageService.getRunnableScripts(projectPath);

      expect(result).toEqual([
        {
          source: 'npm',
          relativeDir: '',
          name: 'build',
          script: 'turbo build',
          command: 'pnpm build',
          manifest: 'PNPM',
        },
        {
          source: 'npm',
          relativeDir: 'api',
          name: 'build',
          script: 'tsc',
          command: 'npm run build',
          manifest: 'api/package.json',
        },
      ]);
    });

    it('gives npm the run verb and yarn the bare script name', async () => {
      const projectPath = '/test/project';
      mockProject(
        { [path.join(projectPath, 'package.json')]: { scripts: { dev: 'vite' } } },
        [],
        [path.join(projectPath, 'yarn.lock')]
      );

      expect((await projectPackageService.getRunnableScripts(projectPath))[0].command).toBe(
        'yarn dev'
      );

      mockProject({ [path.join(projectPath, 'package.json')]: { scripts: { dev: 'vite' } } });

      expect((await projectPackageService.getRunnableScripts(projectPath))[0].command).toBe(
        'npm run dev'
      );
    });

    it('runs composer scripts through composer whatever the package manager', async () => {
      const projectPath = '/test/php';
      mockProject(
        { [path.join(projectPath, 'composer.json')]: { scripts: { test: 'phpunit' } } },
        [],
        [path.join(projectPath, 'pnpm-lock.yaml')]
      );

      const result = await projectPackageService.getRunnableScripts(projectPath);

      expect(result).toEqual([
        {
          source: 'composer',
          relativeDir: '',
          name: 'test',
          script: 'phpunit',
          command: 'composer run-script test',
          manifest: 'Composer',
        },
      ]);
    });

    it('reads a composer script written as a list of commands', async () => {
      const projectPath = '/test/php';
      mockProject({
        [path.join(projectPath, 'composer.json')]: {
          scripts: { check: ['phpstan analyse', 'phpunit'] },
        },
      });

      const result = await projectPackageService.getRunnableScripts(projectPath);

      expect(result[0].script).toBe('phpstan analyse && phpunit');
    });

    it('puts the root first, then subdirectories, npm before composer', async () => {
      const projectPath = '/test/mixed';
      mockProject(
        {
          [path.join(projectPath, 'package.json')]: { scripts: { dev: 'vite' } },
          [path.join(projectPath, 'composer.json')]: { scripts: { lint: 'phpcs' } },
          [path.join(projectPath, 'web', 'package.json')]: { scripts: { build: 'vite build' } },
        },
        ['web']
      );

      const result = await projectPackageService.getRunnableScripts(projectPath);

      expect(result.map(entry => [entry.relativeDir, entry.source, entry.name])).toEqual([
        ['', 'npm', 'dev'],
        ['', 'composer', 'lint'],
        ['web', 'npm', 'build'],
      ]);
    });

    it('names each manifest the way the palette will head its section', async () => {
      // The root reads better as its package manager; a workspace reads better
      // as its path, since several workspaces can share one manager.
      const projectPath = '/test/mixed';
      mockProject(
        {
          [path.join(projectPath, 'package.json')]: { scripts: { dev: 'vite' } },
          [path.join(projectPath, 'composer.json')]: { scripts: { lint: 'phpcs' } },
          [path.join(projectPath, 'web', 'package.json')]: { scripts: { build: 'vite build' } },
          [path.join(projectPath, 'web', 'composer.json')]: { scripts: { fix: 'php-cs-fixer' } },
        },
        ['web'],
        [path.join(projectPath, 'yarn.lock')]
      );

      const result = await projectPackageService.getRunnableScripts(projectPath);

      expect(result.map(entry => entry.manifest)).toEqual([
        'YARN',
        'Composer',
        'web/package.json',
        'web/composer.json',
      ]);
    });

    it('returns nothing for a project with no manifests', async () => {
      mockProject({});

      expect(await projectPackageService.getRunnableScripts('/test/empty')).toEqual([]);
    });
  });
});
