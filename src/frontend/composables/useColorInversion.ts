import { useDark } from '@vueuse/core';
import { watch } from 'vue';

/**
 * Dark mode is palette inversion, not `dark:` variants: every registered
 * --color-<name>-<shade> is rewritten to its 1000-shade counterpart (50<->950,
 * 100<->900, ...) as an inline style on <html>. That means `bg-slate-50` is
 * already theme-aware, and stacking a `dark:` variant on top would fight it.
 *
 * colorScales below must cover every palette useTheme writes, or the missing
 * one resolves in light mode and silently stays light in dark mode. That set
 * is not the same as the set main.css declares: slate is never declared there
 * (it comes from Tailwind's built-in palette) but useTheme overrides it per
 * theme, so it has to invert too. A palette neither declared nor written is
 * inert — Tailwind emits it as a literal with no var() to override.
 *
 * Read and write through getComputedStyle and root.style.setProperty rather
 * than a stylesheet or VueUse's useCssVar, for two separate reasons:
 *
 * - Precedence. useTheme writes its generated palettes as inline styles on
 *   <html>, and inline styles outrank author stylesheets, so an inversion
 *   injected via useStyleTag would be silently overridden by the theme's own
 *   writes. Both sides have to write at the same level; moving either one to
 *   a stylesheet breaks the other.
 * - Cost. useCssVar is a reactive ref, not a getter: every call builds a
 *   shallowRef, a computed and two persistent watchers, and it has no
 *   disposal. Called once per variable here it leaked ~506 watchers per theme
 *   change.
 */

/**
 * Module-level, not per-composable-instance: this state describes the one
 * <html> element, and useTheme re-inverts through it straight after writing a
 * palette. A Map per call would let one caller's idea of the "originals" drift
 * out of step with what is actually on the element.
 */
const originalValues = new Map<string, string>();

/** Scales to inverted. Must cover every palette useTheme writes (see above). */
const colorScales = {
  slate: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  gray: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  zinc: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  neutral: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  stone: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  red: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  orange: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  amber: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  yellow: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  lime: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  green: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  emerald: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  teal: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  cyan: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  sky: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  blue: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  indigo: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  violet: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  purple: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  fuchsia: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  pink: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  rose: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  primary: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  secondary: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  tertiary: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  success: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
  danger: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
};

// Function to get the inverted shade number
function getInvertedShade(shade: number): number {
  return 1000 - shade;
}

/**
 * Read current computed --color-*-* values and cache them as the light-mode
 * originals. getComputedStyle picks up both the stylesheet defaults and the
 * inline overrides useTheme writes, and reads the whole document once rather
 * than per variable.
 */
function initializeColors() {
  const computed = getComputedStyle(document.documentElement);
  for (const [colorName, shades] of Object.entries(colorScales)) {
    for (const shade of shades) {
      const varName = `--color-${colorName}-${shade}`;
      const value = computed.getPropertyValue(varName).trim();
      if (value) {
        originalValues.set(varName, value);
      }
    }
  }
}

/**
 * Swap shades for dark mode, or restore the originals for light.
 *
 * Reads the class off <html> rather than an isDark ref, because this also runs
 * from useTheme, which has no ref of its own. The class is the authoritative
 * signal anyway: useColorMode writes it, and main.css's `.dark` block keys off
 * it.
 */
function applyColorInversion() {
  const root = document.documentElement;

  if (!root.classList.contains('dark')) {
    // Light mode: restore original colors
    for (const [varName, originalValue] of originalValues.entries()) {
      root.style.setProperty(varName, originalValue);
    }
    return;
  }

  // Dark mode: invert colors
  for (const [colorName, shades] of Object.entries(colorScales)) {
    for (const shade of shades) {
      const currentVarName = `--color-${colorName}-${shade}`;
      const invertedVarName = `--color-${colorName}-${getInvertedShade(shade)}`;

      // Get the original value of the inverted shade
      const invertedValue = originalValues.get(invertedVarName);

      if (invertedValue) {
        // Set the current shade to the inverted value
        root.style.setProperty(currentVarName, invertedValue);
      }
    }
  }
}

/**
 * Re-cache the palette and re-apply the inversion. Call straight after writing
 * new --color-* values, which useTheme does on every apply and live preview.
 *
 * Exported as a plain function, not through the composable: useTheme needs it
 * and is not a component, and the state it works on is module-level anyway.
 *
 * Safe to call in either mode. Callers write light-mode values, so what is read
 * back here is always a light palette regardless of the current dark state.
 */
export function reinitializeColors() {
  originalValues.clear();
  initializeColors();
  applyColorInversion();
}

/**
 * Keeps the inversion in step with the dark-mode class. Mount once, in App.
 *
 * Re-applying after a theme change is not this watcher's job -- useTheme calls
 * reinitializeColors itself, so the two can never get out of step no matter how
 * many components hold a useTheme.
 */
export function useColorInversion() {
  const isDark = useDark({
    selector: 'html',
    attribute: 'class',
    valueDark: 'dark',
    valueLight: 'light',
  });

  initializeColors();

  watch(isDark, applyColorInversion, { immediate: true });

  return {
    isDark,
    reinitializeColors,
  };
}
