import * as fs from 'fs/promises';
import * as path from 'path';
import type { DetectedScriptGroup, RunnableScript } from '../../../shared/types/process';

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

  /**
   * Every script a project can run, with its command already assembled.
   *
   * Built here rather than in the client because picking between npm, yarn and
   * pnpm is a per-directory question: a monorepo root and one of its workspaces
   * can use different managers. Resolving that in the client costs one request
   * per subdirectory and shows the wrong command until each reply lands -- which
   * matters when the command is one keystroke from being run.
   *
   * Ordered root-first, then by subdirectory, npm before composer within each,
   * so the list reads the way the project is laid out.
   */
  async getRunnableScripts(projectPath: string): Promise<RunnableScript[]> {
    const [npmGroups, composerGroups] = await Promise.all([
      this.getPackageScriptGroups(projectPath),
      this.getComposerScriptGroups(projectPath),
    ]);

    // One detection per group rather than per script.
    //
    // A workspace with no lockfile of its own inherits the root's manager. In a
    // real pnpm or yarn monorepo the lockfile lives only at the root, so
    // detecting per directory in isolation reported npm for every workspace --
    // and `npm run` inside a pnpm workspace writes a stray package-lock.json
    // and a divergent node_modules.
    const rootManager = await this.detectPackageManager(projectPath);
    const managers = new Map<string, 'npm' | 'yarn' | 'pnpm'>();
    await Promise.all(
      npmGroups.map(async group => {
        if (!group.relativeDir) {
          managers.set('', rootManager);
          return;
        }

        const own = await this.detectPackageManagerIfLocked(projectPath, group.relativeDir);
        managers.set(group.relativeDir, own ?? rootManager);
      })
    );

    const dirs = [...new Set([...npmGroups, ...composerGroups].map(group => group.relativeDir))];
    // '' is the project root, which sorts first; the rest alphabetically.
    dirs.sort((a, b) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)));

    const scripts: RunnableScript[] = [];

    for (const relativeDir of dirs) {
      const npm = npmGroups.find(group => group.relativeDir === relativeDir);
      if (npm) {
        const manager = managers.get(relativeDir) ?? 'npm';
        for (const [name, script] of Object.entries(npm.scripts)) {
          scripts.push({
            source: 'npm',
            relativeDir,
            name,
            script,
            // Only npm needs the `run` verb; yarn and pnpm take the script directly.
            command: manager === 'npm' ? `npm run ${name}` : `${manager} ${name}`,
            // At the root the manager is the useful name; in a workspace the
            // path is, since several can share one manager.
            manifest: relativeDir ? `${relativeDir}/package.json` : manager.toUpperCase(),
          });
        }
      }

      const composer = composerGroups.find(group => group.relativeDir === relativeDir);
      if (composer) {
        for (const [name, script] of Object.entries(composer.scripts)) {
          scripts.push({
            source: 'composer',
            relativeDir,
            name,
            // A composer script can be an array of commands; show it readably.
            script: Array.isArray(script) ? script.join(' && ') : String(script),
            command: `composer run-script ${name}`,
            manifest: relativeDir ? `${relativeDir}/composer.json` : 'Composer',
          });
        }
      }
    }

    return scripts;
  }

  /**
   * The package manager a directory declares for itself, or null if it declares
   * none.
   *
   * detectPackageManager cannot answer this: it defaults to npm, so "npm is
   * what the lockfile says" and "there is no lockfile" come back identical --
   * and a workspace in a pnpm monorepo is the second case, not the first.
   */
  private async detectPackageManagerIfLocked(
    projectPath: string,
    subPath: string
  ): Promise<'npm' | 'yarn' | 'pnpm' | null> {
    const basePath = path.join(projectPath, subPath);

    const exists = async (file: string): Promise<boolean> =>
      fs
        .access(path.join(basePath, file))
        .then(() => true)
        .catch(() => false);

    if (await exists('pnpm-lock.yaml')) return 'pnpm';
    if (await exists('yarn.lock')) return 'yarn';
    if (await exists('package-lock.json')) return 'npm';

    return null;
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
