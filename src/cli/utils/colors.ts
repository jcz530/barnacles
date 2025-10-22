/**
 * Enhanced picocolors that assumes color support when TTY detection fails
 *
 * Some terminal environments (like Claude Code's integrated terminal) don't
 * properly expose process.stdout.isTTY, causing picocolors to disable colors
 * even when the terminal supports them.
 *
 * This wrapper enables colors by default unless explicitly disabled via NO_COLOR
 */

// Set FORCE_COLOR BEFORE importing picocolors if TTY is undefined
if (!process.env.NO_COLOR && !process.env.FORCE_COLOR && process.stdout.isTTY === undefined) {
  process.env.FORCE_COLOR = '1';
}

// Now import picocolors - it will pick up FORCE_COLOR
import pc from 'picocolors';

/**
 * Custom color helpers using ANSI escape codes
 */

/**
 * Create a custom RGB color function
 * @param r Red (0-255)
 * @param g Green (0-255)
 * @param b Blue (0-255)
 */
export const rgb = (r: number, g: number, b: number) => {
  return (text: string) => {
    if (!pc.isColorSupported) return text;
    return `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m`;
  };
};

/**
 * Create a custom background RGB color function
 * @param r Red (0-255)
 * @param g Green (0-255)
 * @param b Blue (0-255)
 */
export const bgRgb = (r: number, g: number, b: number) => {
  return (text: string) => {
    if (!pc.isColorSupported) return text;
    return `\x1b[48;2;${r};${g};${b}m${text}\x1b[49m`;
  };
};

/**
 * Create a color from a hex string
 * @param hex Hex color code (e.g., '#FF5733' or 'FF5733')
 */
export const hex = (hex: string) => {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.slice(0, 2), 16);
  const g = parseInt(cleanHex.slice(2, 4), 16);
  const b = parseInt(cleanHex.slice(4, 6), 16);
  return rgb(r, g, b);
};

/**
 * RGB color type
 */
type RGB = { r: number; g: number; b: number };

/**
 * Parse a hex color to RGB
 */
const hexToRgb = (hex: string): RGB => {
  const cleanHex = hex.replace('#', '');
  return {
    r: parseInt(cleanHex.slice(0, 2), 16),
    g: parseInt(cleanHex.slice(2, 4), 16),
    b: parseInt(cleanHex.slice(4, 6), 16),
  };
};

/**
 * Interpolate between two RGB colors
 * @param color1 Starting color
 * @param color2 Ending color
 * @param factor Interpolation factor (0-1, where 0 is color1 and 1 is color2)
 */
export const interpolateColor = (color1: RGB, color2: RGB, factor: number): RGB => {
  const clampedFactor = Math.max(0, Math.min(1, factor));
  return {
    r: Math.round(color1.r + (color2.r - color1.r) * clampedFactor),
    g: Math.round(color1.g + (color2.g - color1.g) * clampedFactor),
    b: Math.round(color1.b + (color2.b - color1.b) * clampedFactor),
  };
};

/**
 * Create a gradient across text
 * @param text Text to apply gradient to
 * @param startColor Starting color (hex or RGB)
 * @param endColor Ending color (hex or RGB)
 */
export const gradient = (
  text: string,
  startColor: string | RGB,
  endColor: string | RGB
): string => {
  if (!pc.isColorSupported) return text;

  const start = typeof startColor === 'string' ? hexToRgb(startColor) : startColor;
  const end = typeof endColor === 'string' ? hexToRgb(endColor) : endColor;

  const chars = text.split('');
  const length = chars.length;

  if (length === 0) return text;
  if (length === 1) return rgb(start.r, start.g, start.b)(text);

  return (
    chars
      .map((char, index) => {
        const factor = index / (length - 1);
        const color = interpolateColor(start, end, factor);
        return `\x1b[38;2;${color.r};${color.g};${color.b}m${char}`;
      })
      .join('') + '\x1b[39m'
  );
};
/**
 * A helper to perform a gradient from blue to pink that aligns with the Barnacles logo branding
 * @param text
 */
export const brandGradient = (text: string) => gradient(text, '#00c2e5', '#cd67a1');

/**
 * Create a multicolor gradient across text
 * @param text Text to apply gradient to
 * @param colors Array of colors (hex or RGB) to interpolate through
 */
export const multiGradient = (text: string, colors: (string | RGB)[]): string => {
  if (!pc.isColorSupported) return text;
  if (colors.length === 0) return text;
  if (colors.length === 1) {
    const color = typeof colors[0] === 'string' ? hexToRgb(colors[0]) : colors[0];
    return rgb(color.r, color.g, color.b)(text);
  }

  const rgbColors = colors.map(c => (typeof c === 'string' ? hexToRgb(c) : c));
  const chars = text.split('');
  const length = chars.length;

  if (length === 0) return text;

  return (
    chars
      .map((char, index) => {
        const position = index / Math.max(1, length - 1);
        const scaledPosition = position * (rgbColors.length - 1);
        const colorIndex = Math.floor(scaledPosition);
        const factor = scaledPosition - colorIndex;

        const startColor = rgbColors[colorIndex];
        const endColor = rgbColors[Math.min(colorIndex + 1, rgbColors.length - 1)];

        const color = interpolateColor(startColor, endColor, factor);
        return `\x1b[38;2;${color.r};${color.g};${color.b}m${char}`;
      })
      .join('') + '\x1b[39m'
  );
};

/**
 * Predefined custom colors for Barnacles
 */
export const colors = {
  // Brand colors
  primary: hex('#00c2e5'), // Sky blue
  success: hex('#10B981'), // Emerald
  warning: hex('#F59E0B'), // Amber
  error: hex('#EF4444'), // Red
  info: hex('#3B82F6'), // Blue

  // Additional colors
  purple: hex('#A855F7'),
  pink: hex('#cd67a1'),
  orange: hex('#F97316'),
  teal: hex('#14B8A6'),
};

// Re-export picocolors as default
export default pc;
