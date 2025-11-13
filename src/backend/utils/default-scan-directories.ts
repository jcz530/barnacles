import os from 'os';
import path from 'path';
import fs from 'fs/promises';
import { settingsService } from '../services/settings-service';
import { expandTilde } from './path-utils';

/**
 * Get the default directories to scan for projects
 * @returns Array of absolute paths to common development directories
 */
export function getDefaultScanDirectoriesSync(): string[] {
  return [
    path.join(os.homedir(), 'Development'),
    path.join(os.homedir(), 'Projects'),
    path.join(os.homedir(), 'Code'),
    path.join(os.homedir(), 'workspace'),
    path.join(os.homedir(), 'Documents', 'Projects'),
  ];
}

/**
 * Get the scan directories from settings or use defaults
 * @returns Array of absolute paths to scan for projects
 */
export async function getDefaultScanDirectories(): Promise<string[]> {
  const includedDirs = await settingsService.getValue<string[]>('scanIncludedDirectories');

  if (includedDirs && Array.isArray(includedDirs) && includedDirs.length > 0) {
    // Expand tildes in paths and return
    return includedDirs.map(expandTilde);
  }

  // Fallback to default directories
  return getDefaultScanDirectoriesSync();
}

/**
 * Discover which default directories actually exist on the file system
 * @returns Array of objects with directory path and existence status
 */
export async function discoverExistingDirectories(): Promise<
  Array<{ path: string; exists: boolean; readable: boolean }>
> {
  const defaultDirs = getDefaultScanDirectoriesSync();
  const results = await Promise.all(
    defaultDirs.map(async dirPath => {
      try {
        await fs.access(dirPath, fs.constants.R_OK);
        return { path: dirPath, exists: true, readable: true };
      } catch (_error) {
        // Check if directory exists but is not readable
        try {
          await fs.access(dirPath, fs.constants.F_OK);
          return { path: dirPath, exists: true, readable: false };
        } catch {
          return { path: dirPath, exists: false, readable: false };
        }
      }
    })
  );

  return results.filter(result => result.exists && result.readable);
}
