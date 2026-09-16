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
 * `colorScales` and the shade arithmetic live in ./color-scales, which imports
 * nothing. The share card needs the same rule to read a themed variable back
 * correctly, and it must be reachable without pulling this module's `document`
 * and `window` access into a DOM-less compilation.
 *
 * Re-exported as well as imported: callers that already reach for these through
 * this module keep working, and there is still exactly one declaration site.
 */
import { colorScales, getInvertedShade } from './color-scales';

export { colorScales, getInvertedShade, INVERTED_PALETTES } from './color-scales';

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
  if (!isDarkMode()) {
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
 * Whether dark mode is on, as a plain function so the inversion can be driven
 * from useTheme too, which holds no isDark ref of its own.
 *
 * Reads localStorage rather than the `dark` class on <html>. The class is
 * written by useColorMode in a `flush: 'post'` watcher, so anything reading it
 * from an ordinary (`flush: 'pre'`) watcher sees the PREVIOUS mode and inverts
 * one step behind -- light rendering dark colours and vice versa on every
 * toggle, while a reload looked correct because the class was already settled.
 *
 * The stored value is 'light' | 'dark' | 'auto'; 'auto' (and a first run with
 * nothing stored) resolves against the system preference, the same way
 * useColorMode resolves it.
 */
export function isDarkMode(): boolean {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem('vueuse-color-scheme');
  } catch {
    // Storage can throw (private mode, blocked cookies); fall back to system.
  }

  if (stored === 'dark') return true;
  if (stored === 'light') return false;

  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/** Swap shades for dark mode, or restore the originals for light. */
function applyColorInversion() {
  const root = document.documentElement;

  if (!isDarkMode()) {
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
