import { useDark } from '@vueuse/core';
import { watch } from 'vue';

/**
 * Composable to automatically invert Tailwind color scales in dark mode.
 *
 * Dark mode here is palette inversion, not `dark:` variants: every registered
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
export function useColorInversion() {
  const isDark = useDark({
    selector: 'html',
    attribute: 'class',
    valueDark: 'dark',
    valueLight: 'light',
  });

  // Define color scales that should be inverted
  // The key is the color name, and the values are the shade numbers
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

  // Store original values for light mode
  const originalValues = new Map<string, string>();

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

  // Apply color inversion based on dark mode state
  function applyColorInversion() {
    const root = document.documentElement;
    if (isDark.value) {
      // Dark mode: invert colors
      for (const [colorName, shades] of Object.entries(colorScales)) {
        for (const shade of shades) {
          const currentVarName = `--color-${colorName}-${shade}`;
          const invertedShade = getInvertedShade(shade);
          const invertedVarName = `--color-${colorName}-${invertedShade}`;

          // Get the original value of the inverted shade
          const invertedValue = originalValues.get(invertedVarName);

          if (invertedValue) {
            // Set the current shade to the inverted value
            root.style.setProperty(currentVarName, invertedValue);
          }
        }
      }
    } else {
      // Light mode: restore original colors
      for (const [varName, originalValue] of originalValues.entries()) {
        root.style.setProperty(varName, originalValue);
      }
    }
  }

  // Initialize on mount
  initializeColors();

  // Watch for dark mode changes and apply inversion
  watch(isDark, applyColorInversion, { immediate: true });

  /**
   * Re-initialize colors after a theme change
   * This should be called after custom theme colors are applied
   *
   * applyThemeVariables always writes light-mode values, so they can be read
   * back directly as the new originals regardless of the current dark state.
   */
  function reinitializeColors() {
    originalValues.clear();
    initializeColors();
    applyColorInversion();
  }

  return {
    isDark,
    reinitializeColors,
  };
}
