/**
 * Cross-platform utilities for Barnacles
 * Centralizes platform-specific logic to keep code DRY
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

// Platform detection
export const isWindows = process.platform === 'win32';
export const isMac = process.platform === 'darwin';
export const isLinux = process.platform === 'linux';

/**
 * Get the default shell for the current platform
 */
export function getDefaultShell(): string {
  if (isWindows) {
    return process.env.COMSPEC || 'cmd.exe';
  }
  return process.env.SHELL || '/bin/bash';
}

/**
 * Get the command to open a path in the system file manager
 */
export function getFileManagerCommand(targetPath: string): string {
  const escapedPath = targetPath.replace(/"/g, '\\"');
  if (isWindows) {
    return `explorer "${escapedPath}"`;
  }
  if (isMac) {
    return `open "${escapedPath}"`;
  }
  return `xdg-open "${escapedPath}"`;
}

/**
 * Open a path in the system file manager
 */
export async function openInFileManager(targetPath: string): Promise<void> {
  const command = getFileManagerCommand(targetPath);
  await execAsync(command);
}

/**
 * Get the command to copy text to clipboard
 */
export function getClipboardCommand(text: string): string {
  const escapedText = text.replace(/"/g, '\\"');
  if (isWindows) {
    // Windows clip command reads from stdin
    return `echo|set /p="${escapedText}" | clip`;
  }
  if (isMac) {
    return `printf '%s' "${escapedText}" | pbcopy`;
  }
  // Linux - use wl-copy on Wayland, fall back to xclip then xsel on X11
  if (process.env.WAYLAND_DISPLAY) {
    return `printf '%s' "${escapedText}" | wl-copy`;
  }
  return `printf '%s' "${escapedText}" | xclip -selection clipboard 2>/dev/null || printf '%s' "${escapedText}" | xsel --clipboard --input`;
}

/**
 * Copy text to the system clipboard
 */
export async function copyToClipboard(text: string): Promise<void> {
  const command = getClipboardCommand(text);
  await execAsync(command);
}

/**
 * Get the PATH environment variable separator for the current platform
 */
export function getPathSeparator(): string {
  return path.delimiter; // ';' on Windows, ':' on Unix
}

/**
 * Split the PATH environment variable correctly for the current platform
 */
export function splitPath(pathEnv?: string): string[] {
  if (!pathEnv) return [];
  return pathEnv.split(path.delimiter);
}

/**
 * Check if a command exists on the system
 */
export async function commandExists(command: string): Promise<boolean> {
  try {
    if (isWindows) {
      await execAsync(`where ${command}`);
    } else {
      await execAsync(`which ${command}`);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the user's home directory
 * Handles both HOME (Unix) and USERPROFILE (Windows)
 */
export function getHomeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || require('os').homedir();
}

/**
 * Check if the CLI feature is supported on the current platform
 * CLI is disabled on Windows due to symlink and shell config complexities
 */
export function isCliSupported(): boolean {
  return !isWindows;
}

/**
 * Get a platform-specific command to move a file with elevated privileges.
 * - macOS: uses osascript for a GUI password prompt
 * - Linux: uses pkexec (Polkit) with sudo fallback
 * - Windows: not supported (use fs.copyFile directly)
 */
export function getElevatedMoveCommand(srcPath: string, destPath: string): string {
  const escapedSrc = srcPath.replace(/'/g, "'\\''");
  const escapedDest = destPath.replace(/'/g, "'\\''");

  if (isMac) {
    const script = `do shell script "mv '${escapedSrc}' '${escapedDest}'" with administrator privileges`;
    return `osascript -e '${script}'`;
  }

  // Linux: try pkexec first (GUI prompt via Polkit), fall back to sudo
  return `pkexec mv '${escapedSrc}' '${escapedDest}' 2>/dev/null || sudo mv '${escapedSrc}' '${escapedDest}'`;
}
