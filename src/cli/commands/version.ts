import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { compactLogo } from '../utils/branding.js';
import { Command } from '../core/Command.js';

/**
 * Command to open the Barnacles application
 */
export class VersionCommand extends Command {
  readonly name = 'version';
  readonly description = 'Display the current version';
  readonly aliases = ['v'];
  readonly showIntro = false;

  async execute(_flags: Record<string, string | boolean>): Promise<void> {
    try {
      // Find package.json relative to the script location
      // The CLI is bundled into dist/cli/index.js, which is 2 levels deep from package root
      const scriptPath = fileURLToPath(import.meta.url);
      const scriptDir = dirname(scriptPath);
      const packageJsonPath = join(scriptDir, '..', '..', 'package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

      console.log(`${compactLogo} Barnacles v${packageJson.version}`);
    } catch (error) {
      console.error('Error reading version:', error);
      process.exit(1);
    }
  }
}
