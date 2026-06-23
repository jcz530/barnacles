import * as fs from 'fs/promises';
import * as path from 'path';
import type { DetectedScriptGroup } from '../../../shared/types/process';

// Subdirectories that are never workspace roots and should be skipped when
// scanning one level deep for monorepo package.json/composer.json files.
const IGNORED_SUBDIRS = [
  'node_modules',
  '.git',
  'vendor',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '__pycache__',
  'venv',
  'target',
];

class ProjectPackageService {
  /**
   * Get package.json scripts for a single directory (no subdirectory scanning).
   * Used when the caller already has a specific directory to inspect (e.g.
   * matching a running process's cwd to a script).
   */
  async getPackageScripts(dirPath: string): Promise<Record<string, string>> {
    return this.readScriptsFromFile(path.join(dirPath, 'package.json'));
  }

  /**
   * Get composer.json scripts for a single directory (no subdirectory scanning).
   */
  async getComposerScripts(dirPath: string): Promise<Record<string, string>> {
    return this.readScriptsFromFile(path.join(dirPath, 'composer.json'));
  }

  /**
   * Get the immediate subdirectories of a project that aren't ignored, for
   * one-level-deep monorepo workspace detection (e.g. frontend/, backend/).
   */
  private async getScannableSubdirs(projectPath: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(projectPath, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory() && !IGNORED_SUBDIRS.includes(entry.name))
        .map(entry => entry.name);
    } catch {
      return [];
    }
  }

  /**
   * Get package.json scripts for a project, including immediate subdirectories
   * (one level deep) to support monorepo layouts.
   */
  async getPackageScriptGroups(projectPath: string): Promise<DetectedScriptGroup[]> {
    const groups: DetectedScriptGroup[] = [];

    const rootScripts = await this.readScriptsFromFile(path.join(projectPath, 'package.json'));
    if (Object.keys(rootScripts).length > 0) {
      groups.push({ relativeDir: '', scripts: rootScripts });
    }

    const subdirs = await this.getScannableSubdirs(projectPath);
    for (const subdir of subdirs) {
      const scripts = await this.readScriptsFromFile(
        path.join(projectPath, subdir, 'package.json')
      );
      if (Object.keys(scripts).length > 0) {
        groups.push({ relativeDir: subdir, scripts });
      }
    }

    return groups;
  }

  /**
   * Get composer.json scripts for a project, including immediate subdirectories
   * (one level deep) to support monorepo layouts.
   */
  async getComposerScriptGroups(projectPath: string): Promise<DetectedScriptGroup[]> {
    const groups: DetectedScriptGroup[] = [];

    const rootScripts = await this.readScriptsFromFile(path.join(projectPath, 'composer.json'));
    if (Object.keys(rootScripts).length > 0) {
      groups.push({ relativeDir: '', scripts: rootScripts });
    }

    const subdirs = await this.getScannableSubdirs(projectPath);
    for (const subdir of subdirs) {
      const scripts = await this.readScriptsFromFile(
        path.join(projectPath, subdir, 'composer.json')
      );
      if (Object.keys(scripts).length > 0) {
        groups.push({ relativeDir: subdir, scripts });
      }
    }

    return groups;
  }

  private async readScriptsFromFile(filePath: string): Promise<Record<string, string>> {
    try {
      const parsed = JSON.parse(await fs.readFile(filePath, 'utf-8'));
      return parsed.scripts || {};
    } catch {
      return {};
    }
  }

  /**
   * Detect package manager from lock files. Pass `subPath` to detect the
   * package manager used by a specific workspace subdirectory.
   */
  async detectPackageManager(
    projectPath: string,
    subPath?: string
  ): Promise<'npm' | 'yarn' | 'pnpm'> {
    const basePath = subPath ? path.join(projectPath, subPath) : projectPath;

    try {
      // Check for pnpm-lock.yaml
      const hasPnpmLock = await fs
        .access(path.join(basePath, 'pnpm-lock.yaml'))
        .then(() => true)
        .catch(() => false);

      if (hasPnpmLock) {
        return 'pnpm';
      }

      // Check for yarn.lock
      const hasYarnLock = await fs
        .access(path.join(basePath, 'yarn.lock'))
        .then(() => true)
        .catch(() => false);

      if (hasYarnLock) {
        return 'yarn';
      }

      // Default to npm
      return 'npm';
    } catch {
      return 'npm';
    }
  }
}

export const projectPackageService = new ProjectPackageService();
