import { app, dialog } from 'electron';
import {
  existsSync,
  lstatSync,
  symlinkSync,
  unlinkSync,
  chmodSync,
  mkdirSync,
  appendFileSync,
  readFileSync,
} from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { homedir } from 'os';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get the path to the CLI script
 */
export function getCliPath(): string {
  if (app.isPackaged) {
    // In production, use the wrapper script that runs with Electron's Node.js
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'cli', 'barnacles');
  } else {
    // In development, use the wrapper script
    return path.join(__dirname, '../../dist/cli/barnacles');
  }
}

/**
 * Get the symlink target path for the CLI
 * Uses ~/.local/bin which doesn't require sudo (user-owned directory)
 */
export function getSymlinkPath(): string {
  return path.join(homedir(), '.local', 'bin', 'barnacles');
}

/**
 * Get the user's local bin directory
 */
function getLocalBinDir(): string {
  return path.join(homedir(), '.local', 'bin');
}

/**
 * Ensure ~/.local/bin exists and is in PATH
 */
async function ensureLocalBinInPath(): Promise<void> {
  const localBinDir = getLocalBinDir();

  // Create ~/.local/bin if it doesn't exist
  if (!existsSync(localBinDir)) {
    console.log('[CLI] Creating ~/.local/bin directory...');
    mkdirSync(localBinDir, { recursive: true });
  }

  // Check if it's in PATH
  const pathDirs = process.env.PATH?.split(':') || [];
  if (pathDirs.includes(localBinDir)) {
    console.log('[CLI] ~/.local/bin is already in PATH');
    return; // Already in PATH
  }

  console.log('[CLI] ~/.local/bin is not in PATH, adding to shell config files...');

  // Add to shell config files
  const shellConfigFiles = [
    path.join(homedir(), '.zshrc'),
    path.join(homedir(), '.bashrc'),
    path.join(homedir(), '.bash_profile'),
  ];

  const pathExport = `\n# Added by Barnacles\nexport PATH="$HOME/.local/bin:$PATH"\n`;

  let filesUpdated = 0;
  for (const configFile of shellConfigFiles) {
    if (existsSync(configFile)) {
      const content = readFileSync(configFile, 'utf-8');
      // Only add if not already present
      if (!content.includes('$HOME/.local/bin') && !content.includes('~/.local/bin')) {
        console.log(`[CLI] Adding PATH export to ${path.basename(configFile)}`);
        appendFileSync(configFile, pathExport);
        filesUpdated++;
      } else {
        console.log(`[CLI] ${path.basename(configFile)} already contains ~/.local/bin in PATH`);
      }
    }
  }

  if (filesUpdated > 0) {
    console.log(
      `[CLI] Updated ${filesUpdated} shell config file(s). You'll need to restart your terminal or run 'source ~/.zshrc' (or equivalent) for changes to take effect.`
    );
  }
}

/**
 * Check if the CLI is currently installed
 */
export function isCliInstalled(): boolean {
  const symlinkPath = getSymlinkPath();

  if (!existsSync(symlinkPath)) {
    return false;
  }

  try {
    const stats = lstatSync(symlinkPath);
    return stats.isSymbolicLink();
  } catch {
    return false;
  }
}

/**
 * Install the CLI by creating a symlink in ~/.local/bin (no sudo required)
 */
export async function installCli(): Promise<{ success: boolean; error?: string }> {
  const cliPath = getCliPath();
  const symlinkPath = getSymlinkPath();

  try {
    console.log('[CLI] CLI path:', cliPath);
    console.log('[CLI] Symlink path:', symlinkPath);

    // Check if CLI exists
    if (!existsSync(cliPath)) {
      const error = `CLI script not found at ${cliPath}. Please rebuild the application.`;
      console.error('[CLI]', error);
      return {
        success: false,
        error,
      };
    }

    // Ensure the CLI script is executable
    try {
      chmodSync(cliPath, 0o755);
    } catch (chmodError) {
      console.error('Failed to set executable permissions:', chmodError);
    }

    // Ensure ~/.local/bin exists and is in PATH
    console.log('[CLI] Ensuring ~/.local/bin exists and is in PATH...');
    await ensureLocalBinInPath();

    // Check if symlink already exists
    if (existsSync(symlinkPath)) {
      const stats = lstatSync(symlinkPath);
      if (stats.isSymbolicLink()) {
        // Remove existing symlink
        console.log('[CLI] Removing existing symlink...');
        unlinkSync(symlinkPath);
      } else {
        const error = 'A file named "barnacles" already exists at ~/.local/bin';
        console.error('[CLI]', error);
        return {
          success: false,
          error,
        };
      }
    }

    // Create the symlink (no sudo needed for user directory)
    console.log('[CLI] Creating symlink...');
    symlinkSync(cliPath, symlinkPath);
    console.log('[CLI] Symlink created successfully');

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Uninstall the CLI by removing the symlink (no sudo required)
 */
export async function uninstallCli(): Promise<{ success: boolean; error?: string }> {
  const symlinkPath = getSymlinkPath();

  try {
    if (!existsSync(symlinkPath)) {
      return {
        success: false,
        error: 'CLI is not installed',
      };
    }

    const stats = lstatSync(symlinkPath);
    if (!stats.isSymbolicLink()) {
      return {
        success: false,
        error: 'File at ~/.local/bin/barnacles is not a symlink',
      };
    }

    // Remove the symlink (no sudo needed for user directory)
    unlinkSync(symlinkPath);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Show a dialog prompting the user to install the CLI
 */
export async function promptInstallCli(): Promise<void> {
  const result = await dialog.showMessageBox({
    type: 'question',
    title: 'Install Barnacles CLI',
    message: 'Install the "barnacles" command?',
    detail: 'This will make the barnacles command available in your terminal.',
    buttons: ['Install', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
  });

  if (result.response === 0) {
    const installResult = await installCli();

    if (installResult.success) {
      await dialog.showMessageBox({
        type: 'info',
        title: 'Success',
        message: 'CLI installed successfully!',
        detail: 'You can now use the "barnacles" command in your terminal.',
      });
    } else {
      await dialog.showMessageBox({
        type: 'error',
        title: 'Installation Failed',
        message: 'Failed to install CLI',
        detail: installResult.error,
      });
    }
  }
}

/**
 * Show a dialog prompting the user to uninstall the CLI
 */
export async function promptUninstallCli(): Promise<void> {
  const result = await dialog.showMessageBox({
    type: 'question',
    title: 'Uninstall Barnacles CLI',
    message: 'Uninstall the "barnacles" command?',
    detail: 'This will remove the barnacles command from your terminal.',
    buttons: ['Uninstall', 'Cancel'],
    defaultId: 0,
    cancelId: 1,
  });

  if (result.response === 0) {
    const uninstallResult = await uninstallCli();

    if (uninstallResult.success) {
      await dialog.showMessageBox({
        type: 'info',
        title: 'Success',
        message: 'CLI uninstalled successfully!',
        detail: 'The "barnacles" command has been removed from your terminal.',
      });
    } else {
      await dialog.showMessageBox({
        type: 'error',
        title: 'Uninstallation Failed',
        message: 'Failed to uninstall CLI',
        detail: uninstallResult.error,
      });
    }
  }
}
