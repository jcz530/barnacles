import os from 'os';
import path from 'path';

/**
 * Get the default directories to scan for projects
 * @returns Array of absolute paths to common development directories
 */
export function getDefaultScanDirectories(): string[] {
  return [
    path.join(os.homedir(), 'Development'),
    path.join(os.homedir(), 'Projects'),
    path.join(os.homedir(), 'Code'),
    path.join(os.homedir(), 'workspace'),
    path.join(os.homedir(), 'Documents', 'Projects'),
  ];
}
