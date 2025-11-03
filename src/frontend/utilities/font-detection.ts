/**
 * Utility to detect available system fonts
 * Uses canvas-based detection to check which fonts are actually available
 */

// Common system fonts to test for
const COMMON_FONTS = [
  // Sans-serif fonts
  'Arial',
  'Helvetica',
  'Helvetica Neue',
  'Verdana',
  'Tahoma',
  'Trebuchet MS',
  'Segoe UI',
  'Roboto',
  'Ubuntu',
  'Cantarell',
  'Fira Sans',
  'Droid Sans',
  'Inter',
  'SF Pro',
  'SF Pro Display',
  'SF Pro Text',
  'System',
  '-apple-system',
  'BlinkMacSystemFont',

  // Serif fonts
  'Times New Roman',
  'Times',
  'Georgia',
  'Garamond',
  'Palatino',
  'Palatino Linotype',
  'Bookman',
  'New York',
  'Charter',

  // Monospace fonts
  'Courier New',
  'Courier',
  'Monaco',
  'Menlo',
  'Consolas',
  'SF Mono',
  'JetBrains Mono',
  'Fira Code',
  'Source Code Pro',
  'IBM Plex Mono',
  'Cascadia Code',
  'Ubuntu Mono',
  'DejaVu Sans Mono',
  'Inconsolata',
  'Anonymous Pro',
  'Hack',
];

/**
 * Base fonts to use as fallback for comparison
 * These are virtually guaranteed to exist on all systems
 */
const BASE_FONTS = ['monospace', 'sans-serif', 'serif'];

/**
 * Detect if a font is available on the system
 * Works by comparing the width of text rendered in the test font vs base fonts
 */
export function isFontAvailable(fontName: string): boolean {
  // Create a canvas element for text measurement
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) return false;

  // Test string with various characters
  const testString = 'mmmmmmmmmmlli';
  const fontSize = '72px';

  // Measure text width with base fonts
  const baseWidths: Record<string, number> = {};
  for (const baseFont of BASE_FONTS) {
    context.font = `${fontSize} ${baseFont}`;
    baseWidths[baseFont] = context.measureText(testString).width;
  }

  // Measure text width with test font + base font fallback
  let detected = false;
  for (const baseFont of BASE_FONTS) {
    context.font = `${fontSize} "${fontName}", ${baseFont}`;
    const width = context.measureText(testString).width;

    // If width differs from base font, the test font is being used
    if (width !== baseWidths[baseFont]) {
      detected = true;
      break;
    }
  }

  return detected;
}

/**
 * Get all available system fonts
 * Returns a categorized list of fonts
 */
export interface SystemFont {
  name: string;
  category: 'sans-serif' | 'serif' | 'monospace';
  displayName: string;
}

export function getAvailableSystemFonts(): SystemFont[] {
  const availableFonts: SystemFont[] = [];

  for (const fontName of COMMON_FONTS) {
    if (isFontAvailable(fontName)) {
      availableFonts.push({
        name: fontName,
        displayName: fontName,
        category: categorizeFontFamily(fontName),
      });
    }
  }

  // Sort by category, then alphabetically
  availableFonts.sort((a, b) => {
    if (a.category !== b.category) {
      // Order: sans-serif, serif, monospace
      const order = { 'sans-serif': 0, serif: 1, monospace: 2 };
      return order[a.category] - order[b.category];
    }
    return a.displayName.localeCompare(b.displayName);
  });

  return availableFonts;
}

/**
 * Categorize a font family
 */
function categorizeFontFamily(fontName: string): 'sans-serif' | 'serif' | 'monospace' {
  const lowerName = fontName.toLowerCase();

  // Monospace fonts
  const monospaceFonts = [
    'courier',
    'monaco',
    'menlo',
    'consolas',
    'mono',
    'code',
    'source code',
    'dejavu',
    'inconsolata',
    'hack',
    'anonymous',
  ];

  if (monospaceFonts.some(mono => lowerName.includes(mono))) {
    return 'monospace';
  }

  // Serif fonts
  const serifFonts = ['times', 'georgia', 'garamond', 'palatino', 'bookman', 'charter', 'new york'];

  if (serifFonts.some(serif => lowerName.includes(serif))) {
    return 'serif';
  }

  // Default to sans-serif
  return 'sans-serif';
}
