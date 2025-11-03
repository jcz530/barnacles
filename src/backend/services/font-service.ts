import fs from 'fs';
import path from 'path';
import os from 'os';

interface SystemFont {
  name: string;
  path: string;
  family: string;
}

/**
 * Get font directories based on the operating system
 */
function getFontDirectories(): string[] {
  const platform = os.platform();
  const homeDir = os.homedir();

  switch (platform) {
    case 'darwin': // macOS
      return [path.join(homeDir, 'Library', 'Fonts'), '/Library/Fonts', '/System/Library/Fonts'];
    case 'win32': // Windows
      return [
        path.join(process.env.WINDIR || 'C:\\Windows', 'Fonts'),
        path.join(homeDir, 'AppData', 'Local', 'Microsoft', 'Windows', 'Fonts'),
      ];
    case 'linux':
      return [
        '/usr/share/fonts',
        '/usr/local/share/fonts',
        path.join(homeDir, '.fonts'),
        path.join(homeDir, '.local', 'share', 'fonts'),
      ];
    default:
      return [];
  }
}

/**
 * Extract font family name from filename
 * This is a simple heuristic - for production use, you'd want to parse the actual font file
 */
function extractFontFamily(filename: string): string {
  // Remove file extension
  let name = filename.replace(/\.(ttf|otf|woff|woff2|ttc)$/i, '');

  // Remove common suffixes
  name = name.replace(
    /[-_](Regular|Bold|Italic|Light|Medium|Semibold|Black|Thin|Heavy|Condensed|Extended)$/i,
    ''
  );

  // Replace URL encoding (+ for space) with actual spaces
  name = name.replace(/\+/g, ' ');

  // Replace hyphens and underscores with spaces
  name = name.replace(/[-_]/g, ' ');

  return name.trim();
}

/**
 * Check if a file is a font file
 */
function isFontFile(filename: string): boolean {
  const fontExtensions = ['.ttf', '.otf', '.woff', '.woff2', '.ttc'];
  const ext = path.extname(filename).toLowerCase();
  return fontExtensions.includes(ext);
}

/**
 * Recursively scan a directory for font files
 */
function scanDirectory(
  dirPath: string,
  maxDepth: number = 3,
  currentDepth: number = 0
): SystemFont[] {
  const fonts: SystemFont[] = [];

  if (currentDepth > maxDepth) {
    return fonts;
  }

  try {
    if (!fs.existsSync(dirPath)) {
      return fonts;
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        const subDirFonts = scanDirectory(fullPath, maxDepth, currentDepth + 1);
        fonts.push(...subDirFonts);
      } else if (entry.isFile() && isFontFile(entry.name)) {
        const family = extractFontFamily(entry.name);
        fonts.push({
          name: entry.name,
          path: fullPath,
          family,
        });
      }
    }
  } catch (error) {
    // Silently skip directories we can't read (permissions, etc.)
    console.warn(`Could not read directory ${dirPath}:`, error);
  }

  return fonts;
}

class FontService {
  /**
   * Get all system fonts
   * Returns a deduplicated list of font families
   */
  async getSystemFonts(): Promise<string[]> {
    const fontDirs = getFontDirectories();
    const allFonts: SystemFont[] = [];

    // Scan all font directories
    for (const dir of fontDirs) {
      const fonts = scanDirectory(dir);
      allFonts.push(...fonts);
    }

    // Deduplicate by font family name and sort
    const uniqueFamilies = new Set(allFonts.map(font => font.family));
    const sortedFamilies = Array.from(uniqueFamilies).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );

    return sortedFamilies;
  }

  /**
   * Get detailed information about all system fonts
   */
  async getDetailedSystemFonts(): Promise<SystemFont[]> {
    const fontDirs = getFontDirectories();
    const allFonts: SystemFont[] = [];

    // Scan all font directories
    for (const dir of fontDirs) {
      const fonts = scanDirectory(dir);
      allFonts.push(...fonts);
    }

    // Sort by family name
    return allFonts.sort((a, b) => a.family.toLowerCase().localeCompare(b.family.toLowerCase()));
  }
}

export const fontService = new FontService();
