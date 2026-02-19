import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { PermissionError } from '../../shared/errors/permission-error';
import { isWindows, isMac, commandExists, getHomeDir } from '../../shared/utils/platform';

const execAsync = promisify(exec);

export interface IDE {
  id: string;
  name: string;
  executable: string;
  command: string;
  icon?: string;
  color?: string;
  macAppName?: string; // Name of the .app bundle on macOS (e.g., "Cursor.app")
  winPaths?: string[]; // Common Windows installation paths (relative to Program Files or user home)
}

export interface DetectedIDE extends IDE {
  installed: boolean;
  version?: string;
}

const IDE_DEFINITIONS: IDE[] = [
  {
    id: 'vscode',
    name: 'Visual Studio Code',
    executable: 'code',
    command: 'code',
    icon: 'vscode',
    color: '#007ACC',
    macAppName: 'Visual Studio Code.app',
    winPaths: [
      'Microsoft VS Code\\Code.exe',
      'Programs\\Microsoft VS Code\\Code.exe', // User install in AppData\\Local
    ],
  },
  {
    id: 'cursor',
    name: 'Cursor',
    executable: 'cursor',
    command: 'cursor',
    icon: 'cursor',
    color: '#000000',
    macAppName: 'Cursor.app',
    winPaths: ['Cursor\\Cursor.exe', 'Programs\\Cursor\\Cursor.exe'],
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    executable: 'windsurf',
    command: 'windsurf',
    icon: 'windsurf',
    color: '#0EA5E9',
    macAppName: 'Windsurf.app',
    winPaths: ['Windsurf\\Windsurf.exe'],
  },
  {
    id: 'webstorm',
    name: 'WebStorm',
    executable: 'webstorm',
    command: 'webstorm',
    icon: 'webstorm',
    color: '#00CDD7',
    winPaths: ['JetBrains\\WebStorm*\\bin\\webstorm64.exe'],
  },
  {
    id: 'phpstorm',
    name: 'PhpStorm',
    executable: 'phpstorm',
    command: 'phpstorm',
    icon: 'phpstorm',
    color: '#B345F1',
    winPaths: ['JetBrains\\PhpStorm*\\bin\\phpstorm64.exe'],
  },
  {
    id: 'pycharm',
    name: 'PyCharm',
    executable: 'pycharm',
    command: 'pycharm',
    icon: 'pycharm',
    color: '#21D789',
    winPaths: ['JetBrains\\PyCharm*\\bin\\pycharm64.exe'],
  },
  {
    id: 'intellij',
    name: 'IntelliJ IDEA',
    executable: 'idea',
    command: 'idea',
    icon: 'intellij',
    color: '#000000',
    winPaths: ['JetBrains\\IntelliJ IDEA*\\bin\\idea64.exe'],
  },
  {
    id: 'goland',
    name: 'GoLand',
    executable: 'goland',
    command: 'goland',
    icon: 'goland',
    color: '#087CFA',
    winPaths: ['JetBrains\\GoLand*\\bin\\goland64.exe'],
  },
  {
    id: 'rubymine',
    name: 'RubyMine',
    executable: 'rubymine',
    command: 'rubymine',
    icon: 'rubymine',
    color: '#FC801D',
    winPaths: ['JetBrains\\RubyMine*\\bin\\rubymine64.exe'],
  },
  {
    id: 'clion',
    name: 'CLion',
    executable: 'clion',
    command: 'clion',
    icon: 'clion',
    color: '#22D88F',
    winPaths: ['JetBrains\\CLion*\\bin\\clion64.exe'],
  },
  {
    id: 'rider',
    name: 'Rider',
    executable: 'rider',
    command: 'rider',
    icon: 'rider',
    color: '#C90F5E',
    winPaths: ['JetBrains\\Rider*\\bin\\rider64.exe'],
  },
  {
    id: 'sublime',
    name: 'Sublime Text',
    executable: 'subl',
    command: 'subl',
    icon: 'sublime',
    color: '#FF9800',
    winPaths: ['Sublime Text\\sublime_text.exe', 'Sublime Text 3\\sublime_text.exe'],
  },
  {
    id: 'atom',
    name: 'Atom',
    executable: 'atom',
    command: 'atom',
    icon: 'atom',
    color: '#66595C',
    winPaths: ['atom\\atom.exe'],
  },
  {
    id: 'vim',
    name: 'Vim',
    executable: 'vim',
    command: 'vim',
    icon: 'vim',
    color: '#019733',
    winPaths: ['Vim\\vim*\\vim.exe'],
  },
  {
    id: 'nvim',
    name: 'Neovim',
    executable: 'nvim',
    command: 'nvim',
    icon: 'neovim',
    color: '#57A143',
    winPaths: ['Neovim\\bin\\nvim.exe'],
  },
  {
    id: 'emacs',
    name: 'Emacs',
    executable: 'emacs',
    command: 'emacs',
    icon: 'emacs',
    color: '#7F5AB6',
    winPaths: ['Emacs\\*\\bin\\emacs.exe'],
  },
];

class IdeDetectorService {
  /**
   * Detects which IDEs are installed on the system
   */
  async detectInstalledIDEs(): Promise<DetectedIDE[]> {
    const detectedIDEs: DetectedIDE[] = [];

    for (const ide of IDE_DEFINITIONS) {
      const isInstalled = await this.checkIfInstalled(ide);
      const version = isInstalled ? await this.getVersion(ide) : undefined;

      detectedIDEs.push({
        ...ide,
        installed: isInstalled,
        version,
      });
    }

    return detectedIDEs;
  }

  /**
   * Checks if an IDE is installed by trying to run its command
   */
  private async checkIfInstalled(ide: IDE): Promise<boolean> {
    try {
      if (isMac) {
        // On macOS, first check if the .app bundle exists
        if (ide.macAppName) {
          try {
            await fs.access(`/Applications/${ide.macAppName}`);
            return true;
          } catch {
            // App bundle not found, fall through to check PATH
          }
        }
        // Check if the command exists in PATH
        return await commandExists(ide.executable);
      } else if (isWindows) {
        // On Windows, first check common installation paths
        if (ide.winPaths && ide.winPaths.length > 0) {
          const found = await this.checkWindowsPaths(ide.winPaths);
          if (found) return true;
        }
        // Fall back to checking if command is in PATH
        return await commandExists(ide.executable);
      } else {
        // On Linux, use which
        return await commandExists(ide.executable);
      }
    } catch {
      return false;
    }
  }

  /**
   * Check common Windows installation paths for an IDE
   */
  private async checkWindowsPaths(winPaths: string[]): Promise<boolean> {
    const programFiles = process.env['ProgramFiles'] || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const localAppData = process.env['LOCALAPPDATA'] || path.join(getHomeDir(), 'AppData', 'Local');

    const basePaths = [programFiles, programFilesX86, localAppData];

    for (const basePath of basePaths) {
      for (const winPath of winPaths) {
        const fullPath = path.join(basePath, winPath);
        // Handle wildcard paths (e.g., JetBrains\\WebStorm*)
        if (winPath.includes('*')) {
          const found = await this.checkWildcardPath(fullPath);
          if (found) return true;
        } else {
          try {
            await fs.access(fullPath);
            return true;
          } catch {
            // Path doesn't exist, continue
          }
        }
      }
    }
    return false;
  }

  /**
   * Check a path with wildcards (e.g., JetBrains\\WebStorm*\\bin\\webstorm64.exe)
   */
  private async checkWildcardPath(pathPattern: string): Promise<boolean> {
    // Split at wildcard and check if parent directory exists
    const parts = pathPattern.split('*');
    if (parts.length < 2) return false;

    const parentDir = path.dirname(parts[0]);
    try {
      const entries = await fs.readdir(parentDir);
      const baseName = path.basename(parts[0]);

      // Find directories matching the pattern
      for (const entry of entries) {
        if (entry.startsWith(baseName)) {
          const restOfPath = parts.slice(1).join('');
          const fullPath = path.join(parentDir, entry + restOfPath);
          try {
            await fs.access(fullPath);
            return true;
          } catch {
            // Continue checking other matches
          }
        }
      }
    } catch {
      // Parent directory doesn't exist
    }
    return false;
  }

  /**
   * Gets the version of an installed IDE
   */
  private async getVersion(ide: IDE): Promise<string | undefined> {
    try {
      const { stdout } = await execAsync(`${ide.executable} --version`);
      return stdout.trim().split('\n')[0];
    } catch {
      return undefined;
    }
  }

  /**
   * Detects the preferred IDE for a project based on configuration files
   */
  async detectPreferredIDE(projectPath: string): Promise<string | null> {
    try {
      const entries = await fs.readdir(projectPath);

      // Check for IDE-specific directories/files
      const ideMarkers: { [key: string]: string } = {
        '.vscode': 'vscode',
        '.idea': 'intellij',
        '.atom': 'atom',
        '.sublime-project': 'sublime',
      };

      for (const [marker, ideId] of Object.entries(ideMarkers)) {
        if (entries.includes(marker)) {
          return ideId;
        }
      }

      // Check for Cursor-specific markers (Cursor uses .vscode but may have cursor-specific files)
      if (entries.includes('.vscode')) {
        try {
          const vscodeSettingsPath = path.join(projectPath, '.vscode', 'settings.json');
          const settingsContent = await fs.readFile(vscodeSettingsPath, 'utf-8');
          if (settingsContent.includes('cursor') || settingsContent.includes('Cursor')) {
            return 'cursor';
          }
        } catch {
          // Fall back to vscode
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Opens a project in the specified IDE
   */
  async openProjectInIDE(projectPath: string, ideId: string): Promise<void> {
    const ide = IDE_DEFINITIONS.find(i => i.id === ideId);

    if (!ide) {
      throw new Error(`Unknown IDE: ${ideId}`);
    }

    const isInstalled = await this.checkIfInstalled(ide);

    if (!isInstalled) {
      throw new Error(`${ide.name} is not installed on this system`);
    }

    try {
      // On macOS, if the app bundle exists but command isn't in PATH, use open command
      if (isMac && ide.macAppName) {
        try {
          await fs.access(`/Applications/${ide.macAppName}`);
          // Use 'open' command with the app bundle
          await execAsync(`open -a "${ide.macAppName}" "${projectPath}"`);
          return;
        } catch (error) {
          // Check if this is a permission error
          if (PermissionError.isAppleEventsError(error)) {
            throw PermissionError.createIDEPermissionError(ide.name);
          }
          // Fall through to try the command
        }
      }

      // On Windows, use start command to avoid blocking
      if (isWindows) {
        await execAsync(`start "" ${ide.command} "${projectPath}"`);
        return;
      }

      // Execute the command to open the project (macOS fallback and Linux)
      await execAsync(`${ide.command} "${projectPath}"`);
    } catch (error) {
      // Check if this is a permission error
      if (PermissionError.isAppleEventsError(error)) {
        throw PermissionError.createIDEPermissionError(ide.name);
      }

      throw new Error(`Failed to open project in ${ide.name}: ${error}`);
    }
  }

  /**
   * Gets all available IDE definitions
   */
  getAvailableIDEs(): IDE[] {
    return IDE_DEFINITIONS;
  }
}

export const ideDetectorService = new IdeDetectorService();
