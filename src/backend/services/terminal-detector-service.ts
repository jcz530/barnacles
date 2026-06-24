import { exec } from 'child_process';
import { promisify } from 'util';
import { PermissionError } from '../../shared/errors/permission-error';
import { isWindows, isMac, isLinux, commandExists } from '../../shared/utils/platform';

const execAsync = promisify(exec);

export interface Terminal {
  id: string;
  name: string;
  executable: string;
  command: string;
  icon?: string;
  color?: string;
  platform: 'darwin' | 'win32' | 'linux' | 'all';
}

export interface DetectedTerminal extends Terminal {
  installed: boolean;
  version?: string;
}

// macOS terminal definitions
const MAC_TERMINALS: Terminal[] = [
  {
    id: 'iterm',
    name: 'iTerm2',
    executable: 'open',
    command: 'open -a iTerm',
    icon: 'iterm',
    color: '#000000',
    platform: 'darwin',
  },
  {
    id: 'terminal',
    name: 'Terminal',
    executable: 'open',
    command: 'open -a Terminal',
    icon: 'terminal',
    color: '#000000',
    platform: 'darwin',
  },
  {
    id: 'warp',
    name: 'Warp',
    executable: 'open',
    command: 'open -a Warp',
    icon: 'warp',
    color: '#00D9FF',
    platform: 'darwin',
  },
  {
    id: 'alacritty',
    name: 'Alacritty',
    executable: 'open',
    command: 'open -a Alacritty',
    icon: 'alacritty',
    color: '#F46D01',
    platform: 'darwin',
  },
  {
    id: 'kitty',
    name: 'Kitty',
    executable: 'open',
    command: 'open -a kitty',
    icon: 'kitty',
    color: '#000000',
    platform: 'darwin',
  },
  {
    id: 'hyper',
    name: 'Hyper',
    executable: 'open',
    command: 'open -a Hyper',
    icon: 'hyper',
    color: '#000000',
    platform: 'darwin',
  },
  {
    id: 'wezterm',
    name: 'WezTerm',
    executable: 'open',
    command: 'open -a WezTerm',
    icon: 'wezterm',
    color: '#4E49EE',
    platform: 'darwin',
  },
  {
    id: 'ghostty',
    name: 'Ghostty',
    executable: 'open',
    command: 'open -a Ghostty',
    icon: 'ghostty',
    color: '#FF6B00',
    platform: 'darwin',
  },
];

// Windows terminal definitions
const WINDOWS_TERMINALS: Terminal[] = [
  {
    id: 'windows-terminal',
    name: 'Windows Terminal',
    executable: 'wt.exe',
    command: 'wt.exe',
    icon: 'terminal',
    color: '#0078D4',
    platform: 'win32',
  },
  {
    id: 'powershell',
    name: 'PowerShell',
    executable: 'powershell.exe',
    command: 'powershell.exe',
    icon: 'terminal',
    color: '#012456',
    platform: 'win32',
  },
  {
    id: 'cmd',
    name: 'Command Prompt',
    executable: 'cmd.exe',
    command: 'cmd.exe',
    icon: 'terminal',
    color: '#000000',
    platform: 'win32',
  },
  {
    id: 'git-bash',
    name: 'Git Bash',
    executable: 'bash.exe',
    command: 'bash.exe',
    icon: 'terminal',
    color: '#F05032',
    platform: 'win32',
  },
];

// Linux terminal definitions
const LINUX_TERMINALS: Terminal[] = [
  {
    id: 'gnome-terminal',
    name: 'GNOME Terminal',
    executable: 'gnome-terminal',
    command: 'gnome-terminal',
    icon: 'terminal',
    color: '#2E3436',
    platform: 'linux',
  },
  {
    id: 'konsole',
    name: 'Konsole',
    executable: 'konsole',
    command: 'konsole',
    icon: 'terminal',
    color: '#31363B',
    platform: 'linux',
  },
  {
    id: 'xterm',
    name: 'XTerm',
    executable: 'xterm',
    command: 'xterm',
    icon: 'terminal',
    color: '#000000',
    platform: 'linux',
  },
  {
    id: 'alacritty-linux',
    name: 'Alacritty',
    executable: 'alacritty',
    command: 'alacritty',
    icon: 'alacritty',
    color: '#F46D01',
    platform: 'linux',
  },
  {
    id: 'kitty-linux',
    name: 'Kitty',
    executable: 'kitty',
    command: 'kitty',
    icon: 'kitty',
    color: '#000000',
    platform: 'linux',
  },
];

/**
 * Get terminal definitions for the current platform
 */
function getTerminalDefinitions(): Terminal[] {
  if (isMac) return MAC_TERMINALS;
  if (isWindows) return WINDOWS_TERMINALS;
  if (isLinux) return LINUX_TERMINALS;
  return [];
}

class TerminalDetectorService {
  /**
   * Detects which terminals are installed on the system
   */
  async detectInstalledTerminals(): Promise<DetectedTerminal[]> {
    const detectedTerminals: DetectedTerminal[] = [];
    const terminals = getTerminalDefinitions();

    for (const terminal of terminals) {
      const isInstalled = await this.checkIfInstalled(terminal);
      const version = isInstalled ? await this.getVersion(terminal) : undefined;

      detectedTerminals.push({
        ...terminal,
        installed: isInstalled,
        version,
      });
    }

    return detectedTerminals;
  }

  /**
   * Checks if a terminal is installed
   */
  private async checkIfInstalled(terminal: Terminal): Promise<boolean> {
    try {
      if (isMac) {
        // For macOS apps using 'open', check if the app bundle exists
        if (terminal.executable === 'open') {
          const appName = terminal.command.split('-a ')[1];
          const { stdout } = await execAsync(
            `mdfind "kMDItemKind == 'Application'" | grep -i "${appName}.app" | head -1`
          );
          return stdout.trim().length > 0;
        }
        // For CLI tools, check if command exists in PATH
        return await commandExists(terminal.executable);
      } else if (isWindows) {
        // On Windows, use 'where' command
        return await commandExists(terminal.executable);
      } else {
        // On Linux, use 'which'
        return await commandExists(terminal.executable);
      }
    } catch {
      return false;
    }
  }

  /**
   * Gets the version of an installed terminal
   */
  private async getVersion(terminal: Terminal): Promise<string | undefined> {
    try {
      // Skip version check for macOS 'open' command
      if (isMac && terminal.executable === 'open') {
        return undefined;
      }
      const { stdout } = await execAsync(`${terminal.executable} --version`);
      return stdout.trim().split('\n')[0];
    } catch {
      return undefined;
    }
  }

  /**
   * Opens a terminal at the specified path
   */
  async openTerminalAtPath(terminalId: string, targetPath: string): Promise<void> {
    const terminals = getTerminalDefinitions();
    const terminal = terminals.find(t => t.id === terminalId);

    if (!terminal) {
      throw new Error(`Unknown terminal: ${terminalId}`);
    }

    const isInstalled = await this.checkIfInstalled(terminal);

    if (!isInstalled) {
      throw new Error(`${terminal.name} is not installed on this system`);
    }

    try {
      if (isMac) {
        await this.openMacTerminal(terminal, targetPath);
      } else if (isWindows) {
        await this.openWindowsTerminal(terminal, targetPath);
      } else {
        await this.openLinuxTerminal(terminal, targetPath);
      }
    } catch (error) {
      // Check if this is a macOS Apple Events permission error
      if (PermissionError.isAppleEventsError(error)) {
        throw PermissionError.createTerminalPermissionError(terminal.name);
      }

      throw new Error(`Failed to open terminal at path: ${error}`);
    }
  }

  /**
   * Open terminal on macOS
   */
  private async openMacTerminal(terminal: Terminal, targetPath: string): Promise<void> {
    const escapedPath = targetPath.replace(/"/g, '\\"');

    switch (terminal.id) {
      case 'iterm':
        // iTerm2 specific AppleScript - activate and create new window with cd command
        await execAsync(
          `osascript -e 'tell application "iTerm"
            activate
            create window with default profile
            tell current session of current window
              write text "cd \\"${escapedPath}\\""
            end tell
          end tell'`
        );
        break;

      case 'terminal':
        // macOS Terminal.app specific - activate and create new window with cd command
        await execAsync(
          `osascript -e 'tell application "Terminal"
            activate
            do script "cd \\"${escapedPath}\\""
          end tell'`
        );
        break;

      case 'warp':
        // Warp terminal - open directly to the path
        await execAsync(`open -a Warp "${escapedPath}"`);
        break;

      case 'alacritty':
        await execAsync(`open -a Alacritty.app --args --working-directory "${escapedPath}"`);
        break;

      case 'kitty':
        await execAsync(`open -a kitty.app --args --directory="${escapedPath}"`);
        break;

      case 'hyper':
        await execAsync(`open -a Hyper.app --args "${escapedPath}"`);
        break;

      case 'wezterm':
        await execAsync(`open -a WezTerm.app --args start --cwd "${escapedPath}"`);
        break;

      case 'ghostty':
        await execAsync(`open -a Ghostty.app --args --working-directory="${escapedPath}"`);
        break;

      default:
        // Generic approach for other terminals
        await execAsync(`cd "${escapedPath}" && ${terminal.command}`);
    }
  }

  /**
   * Open terminal on Windows
   */
  private async openWindowsTerminal(terminal: Terminal, targetPath: string): Promise<void> {
    const escapedPath = targetPath.replace(/"/g, '""');

    switch (terminal.id) {
      case 'windows-terminal':
        // Windows Terminal supports -d flag for starting directory
        await execAsync(`start "" wt.exe -d "${escapedPath}"`);
        break;

      case 'powershell':
        // Start PowerShell in the target directory
        await execAsync(`start "" powershell.exe -NoExit -Command "Set-Location '${escapedPath}'"`);
        break;

      case 'cmd':
        // Start cmd in the target directory using /K to keep window open
        await execAsync(`start "" cmd.exe /K "cd /d ${escapedPath}"`);
        break;

      case 'git-bash':
        // Git Bash uses --cd flag
        await execAsync(`start "" bash.exe --cd="${escapedPath}"`);
        break;

      default:
        // Generic Windows approach
        await execAsync(`start "" ${terminal.executable}`);
    }
  }

  /**
   * Open terminal on Linux
   */
  private async openLinuxTerminal(terminal: Terminal, targetPath: string): Promise<void> {
    const escapedPath = targetPath.replace(/"/g, '\\"');

    switch (terminal.id) {
      case 'gnome-terminal':
        await execAsync(`gnome-terminal --working-directory="${escapedPath}"`);
        break;

      case 'konsole':
        await execAsync(`konsole --workdir "${escapedPath}"`);
        break;

      case 'xterm':
        await execAsync(`xterm -e "cd '${escapedPath}' && $SHELL"`);
        break;

      case 'alacritty-linux':
        await execAsync(`alacritty --working-directory "${escapedPath}"`);
        break;

      case 'kitty-linux':
        await execAsync(`kitty --directory="${escapedPath}"`);
        break;

      default:
        // Generic Linux approach - try to run in the directory
        await execAsync(`cd "${escapedPath}" && ${terminal.command}`);
    }
  }

  /**
   * Gets all available terminal definitions for the current platform
   */
  getAvailableTerminals(): Terminal[] {
    return getTerminalDefinitions();
  }
}

export const terminalDetectorService = new TerminalDetectorService();
