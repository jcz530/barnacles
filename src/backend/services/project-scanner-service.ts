import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import type { TechnologyDetector } from './technology-detectors';
import { TECHNOLOGY_DETECTORS } from './technology-detectors';

const execAsync = promisify(exec);

// Re-export TechnologyDetector type for external use
export type { TechnologyDetector };

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
  };
  gitInfo?: {
    branch: string;
    status: string;
    lastCommitDate?: Date;
    lastCommitMessage?: string;
    hasUncommittedChanges: boolean;
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
  async detectTechnologies(projectPath: string): Promise<string[]> {
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
      };
    } catch {
      return undefined;
    }
  }

  /**
   * Calculates project statistics
   */
  async getProjectStats(projectPath: string): Promise<ProjectInfo['stats']> {
    let fileCount = 0;
    let directoryCount = 0;
    let totalSize = 0;
    let lastModified = new Date(0);

    const ignoreDirs = [
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

    async function scanDir(dirPath: string): Promise<void> {
      try {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          if (ignoreDirs.includes(entry.name)) {
            continue;
          }

          const fullPath = path.join(dirPath, entry.name);

          if (entry.isDirectory()) {
            directoryCount++;
            await scanDir(fullPath);
          } else if (entry.isFile()) {
            fileCount++;
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

    return {
      fileCount,
      directoryCount,
      size: totalSize,
      lastModified,
    };
  }

  /**
   * Extracts project name and description from package.json or directory name
   */
  async getProjectMetadata(projectPath: string): Promise<{ name: string; description?: string }> {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      return {
        name: packageJson.name || path.basename(projectPath),
        description: packageJson.description,
      };
    } catch {
      // Fallback to directory name
      return {
        name: path.basename(projectPath),
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

    const [metadata, technologies, stats, gitInfo] = await Promise.all([
      this.getProjectMetadata(projectPath),
      this.detectTechnologies(projectPath),
      this.getProjectStats(projectPath),
      this.getGitInfo(projectPath),
    ]);

    return {
      ...metadata,
      path: projectPath,
      technologies,
      stats,
      gitInfo,
    };
  }

  /**
   * Scans multiple directories for projects
   */
  async scanDirectories(basePaths: string[], maxDepth: number = 2): Promise<ProjectInfo[]> {
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
