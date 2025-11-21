import { exec } from 'child_process';
import os from 'os';
import { promisify } from 'util';
import { PermissionError } from '../../shared/errors/permission-error';

const execAsync = promisify(exec);

export interface Terminal {
  id: string;
  name: string;
  executable: string;
  command: string;
  icon?: string;
  color?: string;
}

export interface DetectedTerminal extends Terminal {
  installed: boolean;
  version?: string;
}

const TERMINAL_DEFINITIONS: Terminal[] = [
  {
    id: 'iterm',
    name: 'iTerm2',
    executable: 'open',
    command: 'open -a iTerm',
    icon: 'iterm',
    color: '#000000',
  },
  {
    id: 'terminal',
    name: 'Terminal',
    executable: 'open',
    command: 'open -a Terminal',
    icon: 'terminal',
    color: '#000000',
  },
  {
    id: 'warp',
    name: 'Warp',
    executable: 'open',
    command: 'open -a Warp',
    icon: 'warp',
    color: '#00D9FF',
  },
  {
    id: 'alacritty',
    name: 'Alacritty',
    executable: 'alacritty',
    command: 'alacritty',
    icon: 'alacritty',
    color: '#F46D01',
  },
  {
    id: 'kitty',
    name: 'Kitty',
    executable: 'open',
    command: 'open -a kitty',
    icon: 'kitty',
    color: '#000000',
  },
  {
    id: 'hyper',
    name: 'Hyper',
    executable: 'hyper',
    command: 'hyper',
    icon: 'hyper',
    color: '#000000',
  },
  {
    id: 'wezterm',
    name: 'WezTerm',
    executable: 'wezterm',
    command: 'wezterm',
    icon: 'wezterm',
    color: '#4E49EE',
  },
  {
    id: 'ghostty',
    name: 'Ghostty',
    executable: 'open',
    command: 'open -a Ghostty',
    icon: 'ghostty',
    color: '#FF6B00',
  },
];

class TerminalDetectorService {
  /**
   * Detects which terminals are installed on the system
   */
  async detectInstalledTerminals(): Promise<DetectedTerminal[]> {
    const detectedTerminals: DetectedTerminal[] = [];

    for (const terminal of TERMINAL_DEFINITIONS) {
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
      const platform = os.platform();

      if (platform === 'darwin') {
        // For macOS apps, check if the app bundle exists
        if (terminal.executable === 'open') {
          const appName = terminal.command.split('-a ')[1];
          const { stdout } = await execAsync(
            `mdfind "kMDItemKind == 'Application'" | grep -i "${appName}.app" | head -1`
          );
          return stdout.trim().length > 0;
        }

        // For CLI tools, check if command exists in PATH
        const { stdout } = await execAsync(`which ${terminal.executable}`);
        return stdout.trim().length > 0;
      } else if (platform === 'win32') {
        // On Windows, check if the command exists
        await execAsync(`where ${terminal.executable}`);
        return true;
      } else {
        // On Linux, use which
        const { stdout } = await execAsync(`which ${terminal.executable}`);
        return stdout.trim().length > 0;
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
      const { stdout } = await execAsync(`${terminal.executable} --version`);
      return stdout.trim().split('\n')[0];
    } catch {
      return undefined;
    }
  }

  /**
   * Opens a terminal at the specified path
   */
  async openTerminalAtPath(terminalId: string, path: string): Promise<void> {
    const terminal = TERMINAL_DEFINITIONS.find(t => t.id === terminalId);

    if (!terminal) {
      throw new Error(`Unknown terminal: ${terminalId}`);
    }

    const isInstalled = await this.checkIfInstalled(terminal);

    if (!isInstalled) {
      throw new Error(`${terminal.name} is not installed on this system`);
    }

    try {
      const platform = os.platform();

      if (platform === 'darwin') {
        if (terminal.id === 'iterm') {
          // iTerm2 specific AppleScript - activate and create new window with cd command
          await execAsync(
            `osascript -e 'tell application "iTerm"
              activate
              create window with default profile
              tell current session of current window
                write text "cd \\"${path}\\""
              end tell
            end tell'`
          );
        } else if (terminal.id === 'terminal') {
          // macOS Terminal.app specific - activate and create new window with cd command
          await execAsync(
            `osascript -e 'tell application "Terminal"
              activate
              do script "cd \\"${path}\\""
            end tell'`
          );
        } else if (terminal.id === 'warp') {
          // Warp terminal - open directly to the path
          await execAsync(`open -a Warp "${path}"`);
        } else if (terminal.id === 'alacritty') {
          // Alacritty - open with working directory
          await execAsync(`alacritty --working-directory "${path}"`);
        } else if (terminal.id === 'kitty') {
          // Kitty - open with working directory using macOS open command
          await execAsync(`open -a kitty.app --args --directory="${path}"`);
        } else if (terminal.id === 'hyper') {
          // Hyper - open and cd to path
          await execAsync(`hyper "${path}"`);
        } else if (terminal.id === 'wezterm') {
          // WezTerm - start with working directory
          await execAsync(`wezterm start --cwd "${path}"`);
        } else if (terminal.id === 'ghostty') {
          // Ghostty - open with working directory using macOS open command
          await execAsync(`open -a Ghostty.app --args --working-directory="${path}"`);
        } else {
          // Generic approach for other terminals
          await execAsync(`cd "${path}" && ${terminal.command}`);
        }
      } else {
        // For Linux/Windows, open terminal and change directory
        await execAsync(`cd "${path}" && ${terminal.command}`);
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
   * Gets all available terminal definitions
   */
  getAvailableTerminals(): Terminal[] {
    return TERMINAL_DEFINITIONS;
  }
}

export const terminalDetectorService = new TerminalDetectorService();
