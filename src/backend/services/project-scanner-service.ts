import { exec } from 'child_process';
import fs from 'fs/promises';
import ignore from 'ignore';
import path from 'path';
import { promisify } from 'util';
import type { TechnologyDetector } from './technology-detectors';
import { TECHNOLOGY_DETECTORS } from './technology-detectors';
import { settingsService } from './settings-service';

const execAsync = promisify(exec);

// Re-export TechnologyDetector type for external use
export type { TechnologyDetector };

export interface LanguageStats {
  [techSlug: string]: {
    fileCount: number;
    percentage: number;
    linesOfCode: number;
  };
}

export interface ProjectInfo {
  name: string;
  path: string;
  description?: string;
  technologies: string[];
  stats: {
    fileCount: number;
    directoryCount: number;
    size: number;
    lastModified: Date;
    languageStats: LanguageStats;
    linesOfCode: number;
    thirdPartySize: number;
  };
  gitInfo?: {
    branch: string;
    status: string;
    lastCommitDate?: Date;
    lastCommitMessage?: string;
    hasUncommittedChanges: boolean;
    remoteUrl?: string;
  };
}

class ProjectScannerService {
  /**
   * Scans a directory to check if it's a valid project
   */
  async isValidProject(dirPath: string): Promise<boolean> {
    try {
      const entries = await fs.readdir(dirPath);

      // Check for common project indicators
      const projectFiles = [
        'package.json',
        'composer.json',
        'Cargo.toml',
        'go.mod',
        'requirements.txt',
        'pom.xml',
        'build.gradle',
        '.git',
      ];

      return projectFiles.some(file => entries.includes(file));
    } catch {
      return false;
    }
  }

  /**
   * Detects technologies used in a project
   */
  async detectTechnologies(projectPath: string, fileExtensions: Set<string>): Promise<string[]> {
    const detectedTechs: string[] = [];

    for (const detector of TECHNOLOGY_DETECTORS) {
      let detected = false;

      // Check for presence of specific files
      if (detector.files.length > 0) {
        for (const file of detector.files) {
          try {
            const filePath = path.join(projectPath, file);
            await fs.access(filePath);
            detected = true;
            break;
          } catch {
            // File doesn't exist, continue
          }
        }
      }

      // Check package.json dependencies
      if (!detected && detector.packageJsonKeys && detector.packageJsonKeys.length > 0) {
        try {
          const packageJsonPath = path.join(projectPath, 'package.json');
          const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
          const packageJson = JSON.parse(packageJsonContent);

          const allDeps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies,
          };

          detected = detector.packageJsonKeys.some(key => key in allDeps);
        } catch {
          // package.json doesn't exist or is invalid
        }
      }

      // Check file extensions
      if (!detected && detector.fileExtensions && detector.fileExtensions.length > 0) {
        detected = detector.fileExtensions.some(ext => fileExtensions.has(ext));
      }

      if (detected) {
        detectedTechs.push(detector.slug);
      }
    }

    return detectedTechs;
  }

  /**
   * Gets Git information for a project
   */
  async getGitInfo(projectPath: string): Promise<ProjectInfo['gitInfo'] | undefined> {
    try {
      const gitDir = path.join(projectPath, '.git');
      await fs.access(gitDir);

      // Get current branch
      const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: projectPath,
      });

      // Get git status
      const { stdout: status } = await execAsync('git status --porcelain', {
        cwd: projectPath,
      });

      // Get remote URL
      let remoteUrl: string | undefined;
      try {
        const { stdout: remote } = await execAsync('git config --get remote.origin.url', {
          cwd: projectPath,
        });
        remoteUrl = remote.trim();
      } catch {
        // No remote configured
      }

      // Get last commit info
      let lastCommitDate: Date | undefined;
      let lastCommitMessage: string | undefined;

      try {
        const { stdout: commitDate } = await execAsync('git log -1 --format=%cI', {
          cwd: projectPath,
        });
        lastCommitDate = new Date(commitDate.trim());

        const { stdout: commitMessage } = await execAsync('git log -1 --format=%s', {
          cwd: projectPath,
        });
        lastCommitMessage = commitMessage.trim();
      } catch {
        // No commits yet
      }

      return {
        branch: branch.trim(),
        status: status.trim(),
        lastCommitDate,
        lastCommitMessage,
        hasUncommittedChanges: status.trim().length > 0,
        remoteUrl,
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Loads and parses .gitignore file
   */
  private async loadGitignore(gitignorePath: string): Promise<ReturnType<typeof ignore> | null> {
    try {
      const content = await fs.readFile(gitignorePath, 'utf-8');
      const ig = ignore();
      ig.add(content);
      return ig;
    } catch {
      return null;
    }
  }

  /**
   * Checks if a path should be ignored based on all applicable .gitignore files
   */
  private shouldIgnore(
    fullPath: string,
    isDirectory: boolean,
    gitignoreCache: Map<string, ReturnType<typeof ignore>>
  ): boolean {
    // Check each .gitignore in the hierarchy from root to the file's directory
    for (const [gitignoreDir, filter] of gitignoreCache.entries()) {
      // Calculate relative path from this .gitignore's directory
      const relativeToGitignore = path.relative(gitignoreDir, fullPath);
      const normalizedRelative = relativeToGitignore.split(path.sep).join('/');

      // Only check if this file is under this .gitignore's directory
      if (!normalizedRelative.startsWith('..')) {
        if (isDirectory) {
          if (filter.ignores(normalizedRelative) || filter.ignores(normalizedRelative + '/')) {
            return true;
          }
        } else {
          if (filter.ignores(normalizedRelative)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Counts lines in a file
   */
  private async countLines(filePath: string): Promise<number> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content.split('\n').length;
    } catch {
      return 0;
    }
  }

  /**
   * Calculates the total size of third-party package directories
   * Uses OS-level commands for much faster performance
   */
  async getThirdPartySizeByPath(projectPath: string): Promise<number> {
    const thirdPartyDirs = [
      'node_modules',
      'vendor',
      '.venv',
      'venv',
      'target/debug',
      'target/release',
    ];
    let totalSize = 0;

    for (const dir of thirdPartyDirs) {
      const dirPath = path.join(projectPath, dir);
      try {
        await fs.access(dirPath);
        totalSize += await this.getDirectorySize(dirPath);
      } catch {
        // Directory doesn't exist, skip
      }
    }

    return totalSize;
  }

  /**
   * Calculates directory size using OS-level commands for performance
   */
  private async getDirectorySize(dirPath: string): Promise<number> {
    try {
      // Use 'du' command on Unix-like systems (macOS, Linux) for much faster calculation
      // -sk: sum in kilobytes, -s: summarize (don't show subdirectories)
      const { stdout } = await execAsync(`du -sk "${dirPath}"`, {
        timeout: 30000, // 30 second timeout
      });

      // Output format: "size\tpath"
      const sizeInKB = parseInt(stdout.split('\t')[0], 10);
      return sizeInKB * 1024; // Convert KB to bytes
    } catch {
      // Fallback to slower recursive method if 'du' fails
      return await this.getDirectorySizeRecursive(dirPath);
    }
  }

  /**
   * Fallback: Recursively calculates directory size (slower but works everywhere)
   */
  private async getDirectorySizeRecursive(dirPath: string): Promise<number> {
    let totalSize = 0;

    async function scanDir(currentPath: string): Promise<void> {
      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);

          if (entry.isDirectory()) {
            await scanDir(fullPath);
          } else if (entry.isFile()) {
            try {
              const stats = await fs.stat(fullPath);
              totalSize += stats.size;
            } catch {
              // Skip files we can't stat
            }
          }
        }
      } catch {
        // Skip directories we can't read
      }
    }

    await scanDir(dirPath);
    return totalSize;
  }

  /**
   * Calculates project statistics including language breakdown
   */
  async getProjectStats(
    projectPath: string
  ): Promise<{ stats: ProjectInfo['stats']; fileExtensions: Set<string> }> {
    let fileCount = 0;
    let directoryCount = 0;
    let totalSize = 0;
    let totalLinesOfCode = 0;
    let lastModified = new Date(0);
    const fileExtensions = new Set<string>();
    const extensionCounts: { [ext: string]: number } = {};
    const extensionLines: { [ext: string]: number } = {};

    // Cache for all .gitignore files encountered during the scan
    const gitignoreCache = new Map<string, ReturnType<typeof ignore>>();

    // Load root .gitignore if it exists
    const rootGitignorePath = path.join(projectPath, '.gitignore');
    const rootFilter = await this.loadGitignore(rootGitignorePath);
    if (rootFilter) {
      gitignoreCache.set(projectPath, rootFilter);
    }

    // Load excluded directories from settings
    const excludedDirs = await settingsService.getValue<string[]>('scanExcludedDirectories');
    const ignoreDirs = excludedDirs || [
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

    const ignoreFiles = ['.DS_Store', 'Thumbs.db', 'desktop.ini', '.localized'];

    async function scanDir(dirPath: string): Promise<void> {
      // Check for .gitignore in this directory and add to cache
      const gitignorePath = path.join(dirPath, '.gitignore');
      const filter = await projectScannerService.loadGitignore(gitignorePath);
      if (filter && !gitignoreCache.has(dirPath)) {
        gitignoreCache.set(dirPath, filter);
      }
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          if (ignoreDirs.includes(entry.name)) {
            continue;
          }

          if (ignoreFiles.includes(entry.name)) {
            continue;
          }

          const fullPath = path.join(dirPath, entry.name);

          // Check if file/dir is ignored by any .gitignore in the hierarchy
          if (projectScannerService.shouldIgnore(fullPath, entry.isDirectory(), gitignoreCache)) {
            continue;
          }

          if (entry.isDirectory()) {
            directoryCount++;
            await scanDir(fullPath);
          } else if (entry.isFile()) {
            fileCount++;

            // Track file extension
            const ext = path.extname(entry.name).toLowerCase();
            if (ext) {
              fileExtensions.add(ext);
              extensionCounts[ext] = (extensionCounts[ext] || 0) + 1;

              // Count lines for code files
              const lines = await projectScannerService.countLines(fullPath);
              totalLinesOfCode += lines;
              extensionLines[ext] = (extensionLines[ext] || 0) + lines;
            }

            try {
              const stats = await fs.stat(fullPath);
              totalSize += stats.size;
              if (stats.mtime > lastModified) {
                lastModified = stats.mtime;
              }
            } catch {
              // Skip files we can't stat
            }
          }
        }
      } catch {
        // Skip directories we can't read
      }
    }

    await scanDir(projectPath);

    // Calculate language stats based on file extensions
    const languageStats: LanguageStats = {};

    for (const detector of TECHNOLOGY_DETECTORS) {
      if (detector.fileExtensions && detector.fileExtensions.length > 0) {
        let count = 0;
        let lines = 0;
        for (const ext of detector.fileExtensions) {
          count += extensionCounts[ext] || 0;
          lines += extensionLines[ext] || 0;
        }

        if (count > 0) {
          languageStats[detector.slug] = {
            fileCount: count,
            percentage: fileCount > 0 ? Math.round((count / fileCount) * 100 * 10) / 10 : 0,
            linesOfCode: lines,
          };
        }
      }
    }

    return {
      stats: {
        fileCount,
        directoryCount,
        size: totalSize,
        lastModified,
        languageStats,
        linesOfCode: totalLinesOfCode,
        thirdPartySize: 0, // Don't calculate during scan for performance
      },
      fileExtensions,
    };
  }

  /**
   * Converts a folder name to title case
   */
  private folderNameToTitleCase(folderName: string): string {
    return folderName
      .split(/[-_\s]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Extracts project name and description from package.json or directory name
   */
  async getProjectMetadata(projectPath: string): Promise<{ name: string; description?: string }> {
    const folderName = path.basename(projectPath);
    const name = this.folderNameToTitleCase(folderName);

    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      return {
        name,
        description: packageJson.description,
      };
    } catch {
      // Fallback when no package.json exists
      return {
        name,
      };
    }
  }

  /**
   * Scans a single directory and returns project information
   */
  async scanProject(projectPath: string): Promise<ProjectInfo | null> {
    const isValid = await this.isValidProject(projectPath);
    if (!isValid) {
      return null;
    }

    const [metadata, statsResult, gitInfo] = await Promise.all([
      this.getProjectMetadata(projectPath),
      this.getProjectStats(projectPath),
      this.getGitInfo(projectPath),
    ]);

    const technologies = await this.detectTechnologies(projectPath, statsResult.fileExtensions);

    return {
      ...metadata,
      path: projectPath,
      technologies,
      stats: {
        ...statsResult.stats,
        thirdPartySize: 0, // Don't calculate during scan for performance
      },
      gitInfo,
    };
  }

  /**
   * Scans multiple directories for projects
   */
  async scanDirectories(basePaths: string[], maxDepth: number = 3): Promise<ProjectInfo[]> {
    const projects: ProjectInfo[] = [];
    const scanned = new Set<string>();

    async function scanRecursive(dirPath: string, depth: number): Promise<void> {
      if (depth > maxDepth || scanned.has(dirPath)) {
        return;
      }

      scanned.add(dirPath);

      try {
        // Check if current directory is a project
        const projectInfo = await projectScannerService.scanProject(dirPath);
        if (projectInfo) {
          projects.push(projectInfo);
          // Don't scan subdirectories if we found a project
          return;
        }

        // Otherwise, scan subdirectories
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            await scanRecursive(path.join(dirPath, entry.name), depth + 1);
          }
        }
      } catch {
        // Skip directories we can't access
      }
    }

    for (const basePath of basePaths) {
      await scanRecursive(basePath, 0);
    }

    return projects;
  }

  /**
   * Gets all available technology detectors
   */
  getTechnologyDetectors(): TechnologyDetector[] {
    return TECHNOLOGY_DETECTORS;
  }
}

export const projectScannerService = new ProjectScannerService();
