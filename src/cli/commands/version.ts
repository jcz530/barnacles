import { readFileSync } from 'fs';
import { join } from 'path';
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
      // In production, the CLI is installed as a package, so we can find package.json
      // by looking relative to the node_modules or the project root
      let packageJson;

      // Try to find package.json from current working directory first (for local development)
      try {
        packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
        if (packageJson.name !== 'barnacles') {
          throw new Error('Not the barnacles package.json');
        }
      } catch {
        // Fallback: try relative to the script location (for installed package)
        // When installed, dist/cli/index.js is 2 levels deep from package root
        const scriptDir = new URL('.', import.meta.url).pathname;
        packageJson = JSON.parse(
          readFileSync(join(scriptDir, '..', '..', '..', 'package.json'), 'utf-8')
        );
      }

      console.log(`${compactLogo} Barnacles v${packageJson.version}`);
    } catch (error) {
      console.error('Error reading version:', error);
      process.exit(1);
    }
  }
}
