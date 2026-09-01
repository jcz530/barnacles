import os from 'os';
import path from 'path';

/**
 * Expands tilde (~) in paths to the user's home directory
 * @param filepath - Path that may contain a tilde
 * @returns Expanded absolute path
 */
export function expandTilde(filepath: string): string {
  // Accept the native separator too: stored paths use `~/`, but a caller on
  // Windows may well hand us `~\\projects`.
  if (filepath === '~') {
    return os.homedir();
  }
  if (filepath.startsWith('~/') || filepath.startsWith('~\\')) {
    return path.join(os.homedir(), filepath.slice(2));
  }
  return filepath;
}

/**
 * Collapses the user's home directory in a path back to a tilde, so stored
 * paths match the `~/...` form used by the default scan directories.
 * @param filepath - Absolute path that may live under the home directory
 * @returns Path with the home directory replaced by `~`, or the input unchanged
 */
export function collapseTilde(filepath: string): string {
  const home = os.homedir();
  if (filepath === home) {
    return '~';
  }
  if (filepath.startsWith(home + path.sep)) {
    // Always emit `~/`, matching the stored defaults, so the value round-trips
    // through expandTilde on every platform.
    return `~/${path.relative(home, filepath).split(path.sep).join('/')}`;
  }
  return filepath;
}
