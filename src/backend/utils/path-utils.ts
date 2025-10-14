import os from 'os';
import path from 'path';

/**
 * Expands tilde (~) in paths to the user's home directory
 * @param filepath - Path that may contain a tilde
 * @returns Expanded absolute path
 */
export function expandTilde(filepath: string): string {
  if (filepath.startsWith('~/') || filepath === '~') {
    return path.join(os.homedir(), filepath.slice(2));
  }
  return filepath;
}
