import { spawn } from 'child_process';
import { Command } from '../core/Command.js';
import { brandGradient, colors } from '../utils/colors.js';

/**
 * Command to open the Barnacles application
 */
export class OpenCommand extends Command {
  readonly name = 'open';
  readonly description = 'Open the Barnacles application';
  readonly aliases = ['o'];
  readonly showIntro = false;

  async execute(_flags: Record<string, string | boolean>): Promise<void> {
    console.log(
      `${colors.primary('Opening')} ${brandGradient('Barnacles')}${colors.primary('...')}`
    );

    if (process.platform === 'darwin') {
      // macOS: 'open -a' will launch if not running, or focus if already running
      spawn('open', ['-a', 'Barnacles'], {
        detached: true,
        stdio: 'ignore',
      }).unref();
    } else if (process.platform === 'win32') {
      // Windows: Try to launch via Start menu or AppData path
      const appName = 'Barnacles';
      spawn('cmd', ['/c', 'start', '', appName], {
        detached: true,
        stdio: 'ignore',
        shell: true,
      }).unref();
    } else {
      // Linux: Try common application launcher commands
      // Try xdg-open first (most universal), fall back to direct executable
      spawn('xdg-open', ['barnacles.desktop'], {
        detached: true,
        stdio: 'ignore',
      }).unref();
    }
  }
}
