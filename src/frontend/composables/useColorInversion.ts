import { useCssVar, useDark } from '@vueuse/core';
import { watch } from 'vue';

/**
 * Composable to automatically invert Tailwind color scales in dark mode
 * Uses VueUse's useCssVar to dynamically update CSS variables
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
  };

  // Store original values for light mode
  const originalValues = new Map<string, string>();

  // Function to get the inverted shade number
  function getInvertedShade(shade: number): number {
    return 1000 - shade;
  }

  // Initialize and store original color values
  function initializeColors() {
    for (const [colorName, shades] of Object.entries(colorScales)) {
      for (const shade of shades) {
        const varName = `--color-${colorName}-${shade}`;
        const cssVar = useCssVar(varName, document.documentElement);

        // Store the original value
        if (cssVar.value) {
          originalValues.set(varName, cssVar.value);
        }
      }
    }
  }

  // Apply color inversion based on dark mode state
  function applyColorInversion() {
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
            const cssVar = useCssVar(currentVarName, document.documentElement);
            cssVar.value = invertedValue;
          }
        }
      }
    } else {
      // Light mode: restore original colors
      for (const [varName, originalValue] of originalValues.entries()) {
        const cssVar = useCssVar(varName, document.documentElement);
        cssVar.value = originalValue;
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
