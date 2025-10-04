import { exec } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface IDE {
  id: string;
  name: string;
  executable: string;
  command: string;
  icon?: string;
  color?: string;
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
  },
  {
    id: 'cursor',
    name: 'Cursor',
    executable: 'cursor',
    command: 'cursor',
    icon: 'cursor',
    color: '#000000',
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    executable: 'windsurf',
    command: 'windsurf',
    icon: 'windsurf',
    color: '#0EA5E9',
  },
  {
    id: 'webstorm',
    name: 'WebStorm',
    executable: 'webstorm',
    command: 'webstorm',
    icon: 'webstorm',
    color: '#00CDD7',
  },
  {
    id: 'phpstorm',
    name: 'PhpStorm',
    executable: 'phpstorm',
    command: 'phpstorm',
    icon: 'phpstorm',
    color: '#B345F1',
  },
  {
    id: 'pycharm',
    name: 'PyCharm',
    executable: 'pycharm',
    command: 'pycharm',
    icon: 'pycharm',
    color: '#21D789',
  },
  {
    id: 'intellij',
    name: 'IntelliJ IDEA',
    executable: 'idea',
    command: 'idea',
    icon: 'intellij',
    color: '#000000',
  },
  {
    id: 'goland',
    name: 'GoLand',
    executable: 'goland',
    command: 'goland',
    icon: 'goland',
    color: '#087CFA',
  },
  {
    id: 'rubymine',
    name: 'RubyMine',
    executable: 'rubymine',
    command: 'rubymine',
    icon: 'rubymine',
    color: '#FC801D',
  },
  {
    id: 'clion',
    name: 'CLion',
    executable: 'clion',
    command: 'clion',
    icon: 'clion',
    color: '#22D88F',
  },
  {
    id: 'rider',
    name: 'Rider',
    executable: 'rider',
    command: 'rider',
    icon: 'rider',
    color: '#C90F5E',
  },
  {
    id: 'sublime',
    name: 'Sublime Text',
    executable: 'subl',
    command: 'subl',
    icon: 'sublime',
    color: '#FF9800',
  },
  {
    id: 'atom',
    name: 'Atom',
    executable: 'atom',
    command: 'atom',
    icon: 'atom',
    color: '#66595C',
  },
  {
    id: 'vim',
    name: 'Vim',
    executable: 'vim',
    command: 'vim',
    icon: 'vim',
    color: '#019733',
  },
  {
    id: 'nvim',
    name: 'Neovim',
    executable: 'nvim',
    command: 'nvim',
    icon: 'neovim',
    color: '#57A143',
  },
  {
    id: 'emacs',
    name: 'Emacs',
    executable: 'emacs',
    command: 'emacs',
    icon: 'emacs',
    color: '#7F5AB6',
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
      const platform = os.platform();

      if (platform === 'darwin') {
        // On macOS, check if the command exists in PATH
        const { stdout } = await execAsync(`which ${ide.executable}`);
        return stdout.trim().length > 0;
      } else if (platform === 'win32') {
        // On Windows, check if the command exists
        await execAsync(`where ${ide.executable}`);
        return true;
      } else {
        // On Linux, use which
        const { stdout } = await execAsync(`which ${ide.executable}`);
        return stdout.trim().length > 0;
      }
    } catch {
      return false;
    }
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
      // Execute the command to open the project
      await execAsync(`${ide.command} "${projectPath}"`);
    } catch (error) {
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
