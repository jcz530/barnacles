import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Common icon/logo filenames to search for in projects
 */
const ICON_FILENAMES = [
  'favicon.ico',
  'favicon.png',
  'favicon.svg',
  'logo.png',
  'logo.svg',
  'logo.jpg',
  'logo.jpeg',
  'icon.png',
  'icon.svg',
  'app-icon.png',
  'app-icon.svg',
];

/**
 * Common directories where icons might be located
 */
const ICON_DIRECTORIES = [
  '',
  'public',
  'static',
  'assets',
  'src',
  'public/assets',
  'public/images',
  'static/images',
  'assets/images',
  'src/assets',
  'src/assets/images',
  'images',
];

/**
 * Finds an icon/logo file in the project directory
 * @param projectPath The root path of the project
 * @returns The relative path to the icon file from the project root, or null if not found
 */
export async function findProjectIcon(projectPath: string): Promise<string | null> {
  // Check each possible directory
  for (const dir of ICON_DIRECTORIES) {
    const searchDir = path.join(projectPath, dir);

    // Check if directory exists
    try {
      await fs.access(searchDir);
    } catch {
      continue;
    }

    // Check each possible icon filename
    for (const filename of ICON_FILENAMES) {
      const iconPath = path.join(searchDir, filename);

      try {
        await fs.access(iconPath);
        // Return relative path from project root
        return path.relative(projectPath, iconPath);
      } catch {
        // File doesn't exist, continue
      }
    }
  }

  return null;
}
