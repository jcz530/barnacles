/**
 * The palettes dark mode inverts, and the arithmetic that inverts them.
 *
 * Split out of useColorInversion so readers that only need the *rule* — which
 * palettes inline-style variables get rewritten, and to what — do not have to
 * import a module that touches `document`, `window` and `@vueuse/core`. The
 * share card needs exactly that rule to read a themed variable back correctly,
 * and its tests compile without the DOM lib (vitest runs them in node).
 *
 * Deliberately import-free: anything added here is added to that compilation.
 */

/**
 * The palettes that invert: exactly the six useTheme generates.
 *
 * The stock Tailwind scales (gray, red, blue, amber, ...) are deliberately not
 * here. main.css declares no --color-<stock>-* variable, so Tailwind compiles
 * `text-amber-600` to a literal colour with no var() to override -- writing
 * those variables never changed a pixel. It did, however, leave inverted values
 * on the element for the next read to mistake for originals, which is one of
 * the ways the palette folded in on itself. A utility using a stock palette is
 * simply not theme-aware; the fix for that is to use a theme palette, not to
 * invert a variable nothing reads.
 */
export const colorScales = {
  slate: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  primary: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  secondary: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  tertiary: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  success: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  danger: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
};

/**
 * The palettes that invert, by name. A reader of these variables can tell a
 * themed palette, whose value moves with the mode, from an inert stock one.
 */
export const INVERTED_PALETTES = Object.keys(colorScales);

/** 50 <-> 950, 100 <-> 900, ... */
export function getInvertedShade(shade: number): number {
  return 1000 - shade;
}
