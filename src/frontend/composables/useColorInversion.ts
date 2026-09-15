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
const colorScales = {
  slate: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950],
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
 * Cache the light-mode palette, which every inversion is computed from.
 *
 * Never read back a value we may have written ourselves. Reading the element
 * while dark would cache the values we previously inverted AS the originals --
 * a palette folded in on itself, where light restores inverted values and dark
 * inverts them a second time. That is what made light render dark and dark
 * render washed out after cycling modes.
 *
 * So the element is only read for scales nothing has overridden yet (the stock
 * Tailwind palettes, straight from the stylesheet), and only while light.
 * useTheme's generated palettes arrive through `overrides` instead: it has the
 * light hex values in hand before it writes them, so they never have to be read
 * back off an element that may already be inverted.
 */
function initializeColors(overrides?: Record<string, string>) {
  if (!document.documentElement.classList.contains('dark')) {
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

  if (overrides) {
    for (const [varName, value] of Object.entries(overrides)) {
      originalValues.set(varName, value);
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
 * Pass the light-mode values just written as `overrides`. They are the ones
 * that must not be read back off the element -- see initializeColors.
 *
 * Exported as a plain function, not through the composable: useTheme needs it
 * and is not a component, and the state it works on is module-level anyway.
 */
export function reinitializeColors(overrides?: Record<string, string>) {
  originalValues.clear();
  initializeColors(overrides);
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
