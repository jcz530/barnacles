/**
 * High-quality color shade generator using OKLCH color space
 * Generates perceptually uniform color palettes for design systems
 */

import { converter, formatHex, formatRgb, parse, type Oklch, type Rgb } from 'culori';

export interface ShadeConfig {
  /** Base color in any CSS format */
  baseColor: string;
  /** Number of shades to generate (default: 11) */
  count?: number;
  /** Algorithm preset */
  algorithm?: 'tailwind' | 'vibrant' | 'natural';
  /** Lightness curve easing (0 = linear, 1 = eased, default: 0.5) */
  lightnessCurve?: number;
  /** Chroma intensity multiplier (0.5 = less saturated, 1.5 = more saturated, default: 1) */
  chromaIntensity?: number;
  /** Force base color position (0-10, default: auto-detect) */
  basePosition?: number;
  /** Minimum lightness for darkest shade (10-25, default: 15) */
  minLightness?: number;
}

export interface Shade {
  /** Shade number (e.g., 50, 100, 200...) */
  name: string;
  /** Hex color value */
  hex: string;
  /** RGB color value */
  rgb: string;
  /** OKLCH values */
  oklch: { l: number; c: number; h: number };
  /** Lightness percentage (0-100) */
  lightness: number;
}

export interface GeneratedPalette {
  /** Original base color */
  baseColor: string;
  /** Generated shades */
  shades: Shade[];
  /** Which shade is closest to the base color */
  baseShadeIndex: number;
}

/**
 * Standard Tailwind shade names
 */
const TAILWIND_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

/**
 * Convert any CSS color to OKLCH
 */
function toOklch(color: string): Oklch | undefined {
  const parsed = parse(color);
  if (!parsed) return undefined;
  return converter('oklch')(parsed);
}

/**
 * Get chroma adjustment factor based on algorithm and shade
 */
function getChromaAdjustment(shadeIndex: number, totalShades: number, algorithm: string): number {
  const position = shadeIndex / (totalShades - 1); // 0 to 1

  switch (algorithm) {
    case 'vibrant':
      // Maintain high saturation throughout
      if (position < 0.2) return -0.2; // Slight reduction in very light
      if (position > 0.9) return -0.15; // Slight reduction in very dark
      return 0.05; // Boost in middle ranges
    case 'natural':
      // More desaturation in extremes
      if (position < 0.2) return -0.4;
      if (position < 0.4) return -0.15;
      if (position > 0.8) return -0.1;
      if (position > 0.9) return -0.2;
      return 0;
    case 'tailwind':
    default:
      // Tailwind-like curve
      if (position < 0.09) return -0.4; // 50
      if (position < 0.18) return -0.25; // 100
      if (position < 0.27) return -0.15; // 200
      if (position < 0.36) return -0.05; // 300
      if (position < 0.45) return -0.02; // 400
      if (position < 0.55) return 0; // 500 (base)
      if (position < 0.64) return 0.02; // 600
      if (position < 0.73) return 0.05; // 700
      if (position < 0.82) return 0.03; // 800
      if (position < 0.91) return 0; // 900
      return -0.1; // 950
  }
}

/**
 * Generate lightness values with configurable curve
 * @param count Number of shades to generate
 * @param curve Easing amount (0 = linear, 1 = fully eased, default: 0.5)
 * @param minLightness Minimum lightness for darkest shade (10-25, default: 15)
 */
function generateLightnessScale(
  count: number,
  curve: number = 0.5,
  minLightness: number = 15
): number[] {
  const lightnesses: number[] = [];

  // Configurable range for better dark shade differentiation
  const maxLightness = 96;
  const range = maxLightness - minLightness;

  for (let i = 0; i < count; i++) {
    const position = i / (count - 1); // 0 to 1

    // Interpolate between linear and eased distribution
    let adjustedPosition: number;

    if (curve === 0) {
      // Fully linear
      adjustedPosition = position;
    } else {
      // Apply improved easing curve that provides better separation in darks
      // Using a cubic ease-in-out for smoother distribution
      const eased =
        position < 0.5
          ? 4 * position * position * position
          : 1 - Math.pow(-2 * position + 2, 3) / 2;

      // Blend between linear and eased based on curve parameter
      adjustedPosition = position * (1 - curve) + eased * curve;
    }

    // Map to improved lightness range
    const lightness = maxLightness - adjustedPosition * range;

    lightnesses.push(lightness);
  }

  return lightnesses;
}

/**
 * Find which shade index is closest to the base color's lightness
 */
function findBaseShadeIndex(baseOklch: Oklch, lightnessScale: number[]): number {
  let closestIndex = 0;
  let minDiff = Infinity;

  lightnessScale.forEach((l, index) => {
    // OKLCH lightness is 0-1, scale is 0-100
    const diff = Math.abs(l - baseOklch.l * 100);
    if (diff < minDiff) {
      minDiff = diff;
      closestIndex = index;
    }
  });

  return closestIndex;
}

/**
 * Generate a color palette from a base color
 */
export function generateShades(config: ShadeConfig): GeneratedPalette | null {
  const {
    baseColor,
    count = 11,
    algorithm = 'tailwind',
    lightnessCurve = 0.5,
    chromaIntensity = 1,
    basePosition,
    minLightness = 15,
  } = config;

  // Parse base color to OKLCH
  const baseOklch = toOklch(baseColor);
  if (!baseOklch) return null;

  // Generate lightness scale with custom curve and minimum lightness
  const lightnessScale = generateLightnessScale(count, lightnessCurve, minLightness);

  // Determine base shade index
  const baseShadeIndex =
    basePosition !== undefined
      ? Math.max(0, Math.min(count - 1, basePosition))
      : findBaseShadeIndex(baseOklch, lightnessScale);

  // Generate shades
  const shades: Shade[] = lightnessScale.map((targetLightness, index) => {
    // Calculate chroma adjustment with intensity multiplier
    const chromaAdjustment = getChromaAdjustment(index, count, algorithm);
    const adjustedChroma = Math.max(0, baseOklch.c * (1 + chromaAdjustment) * chromaIntensity);

    // Create OKLCH color (lightness 0-1 scale in OKLCH)
    const shadeOklch: Oklch = {
      mode: 'oklch',
      l: targetLightness / 100, // Convert from 0-100 to 0-1
      c: adjustedChroma,
      h: baseOklch.h ?? 0,
    };

    // Convert to RGB and hex
    const shadeRgb = converter('rgb')(shadeOklch);
    const hex = formatHex(shadeRgb);
    const rgbString = formatRgb(shadeRgb);

    return {
      name: String(TAILWIND_SHADES[index] ?? index * 100),
      hex,
      rgb: rgbString,
      oklch: {
        l: Math.round(shadeOklch.l * 1000) / 1000,
        c: Math.round(shadeOklch.c * 1000) / 1000,
        h: Math.round((shadeOklch.h ?? 0) * 10) / 10,
      },
      lightness: Math.round(targetLightness),
    };
  });

  return {
    baseColor,
    shades,
    baseShadeIndex,
  };
}

/**
 * Calculate WCAG contrast ratio between two colors
 * Returns ratio (1-21)
 */
export function calculateContrast(color1: string, color2: string): number {
  const rgb1 = converter('rgb')(parse(color1));
  const rgb2 = converter('rgb')(parse(color2));

  if (!rgb1 || !rgb2) return 1;

  // Calculate relative luminance
  const luminance = (color: Rgb) => {
    const [r, g, b] = [color.r, color.g, color.b].map(val => {
      const v = val;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  const lum1 = luminance(rgb1);
  const lum2 = luminance(rgb2);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if a shade has sufficient contrast for text
 */
export interface ContrastCheck {
  /** Contrast with white text */
  white: number;
  /** Contrast with black text */
  black: number;
  /** Recommended text color */
  recommendedText: 'white' | 'black';
  /** Passes WCAG AA for normal text (4.5:1) */
  passesAA: boolean;
  /** Passes WCAG AAA for normal text (7:1) */
  passesAAA: boolean;
}

export function checkShadeContrast(shadeHex: string): ContrastCheck {
  const whiteContrast = calculateContrast(shadeHex, '#ffffff');
  const blackContrast = calculateContrast(shadeHex, '#000000');

  const recommendedText = whiteContrast > blackContrast ? 'white' : 'black';
  const bestContrast = Math.max(whiteContrast, blackContrast);

  return {
    white: Math.round(whiteContrast * 100) / 100,
    black: Math.round(blackContrast * 100) / 100,
    recommendedText,
    passesAA: bestContrast >= 4.5,
    passesAAA: bestContrast >= 7,
  };
}
