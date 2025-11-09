import * as fs from 'fs/promises';
import * as path from 'path';

class ProjectPackageService {
  /**
   * Get package.json scripts for a project
   */
  async getPackageScripts(projectPath: string): Promise<Record<string, string>> {
    const packageJsonPath = path.join(projectPath, 'package.json');

    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      return packageJson.scripts || {};
    } catch {
      return {};
    }
  }

  /**
   * Get composer.json scripts for a project
   */
  async getComposerScripts(projectPath: string): Promise<Record<string, string>> {
    const composerJsonPath = path.join(projectPath, 'composer.json');

    try {
      const composerJson = JSON.parse(await fs.readFile(composerJsonPath, 'utf-8'));
      return composerJson.scripts || {};
    } catch {
      return {};
    }
  }

  /**
   * Detect package manager from lock files
   */
  async detectPackageManager(projectPath: string): Promise<'npm' | 'yarn' | 'pnpm'> {
    try {
      // Check for pnpm-lock.yaml
      const hasPnpmLock = await fs
        .access(path.join(projectPath, 'pnpm-lock.yaml'))
        .then(() => true)
        .catch(() => false);

      if (hasPnpmLock) {
        return 'pnpm';
      }

      // Check for yarn.lock
      const hasYarnLock = await fs
        .access(path.join(projectPath, 'yarn.lock'))
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
