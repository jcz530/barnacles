import os from 'os';
import path from 'path';
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
