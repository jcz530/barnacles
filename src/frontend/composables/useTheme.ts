import { computed, onScopeDispose, watch } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import { generateShades } from '../../shared/utilities/shade-generator';
import type { Theme } from '../../shared/types/theme';
import { reinitializeColors } from './useColorInversion';
import { useQueries } from './useQueries';

const TAILWIND_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

/**
 * Whether some live instance is already driving applyThemeVariables. The
 * palette belongs to the one <html> element, so exactly one watcher should
 * write it however many components hold a useTheme.
 */
let hasApplyOwner = false;

/**
 * Options for useTheme.
 *
 * `applyToDocument` opts a caller in to owning the apply-and-invert watcher.
 * App passes it; every other caller just reads or mutates themes and must not,
 * or mounting one of them would repaint the palette (see the watcher below).
 */
export interface UseThemeOptions {
  applyToDocument?: boolean;
}

/**
 * Write (or clear, on null) a CSS variable as an inline style on <html>.
 *
 * Inline rather than a stylesheet because useColorInversion reads these back
 * with getComputedStyle and re-inverts them, and inline styles outrank author
 * stylesheets — if the two sides wrote at different precedence levels, one
 * would silently override the other.
 *
 * Plain setProperty rather than VueUse's useCssVar because useCssVar is a
 * reactive ref, not a setter: each call builds a shallowRef, a computed and
 * two persistent watchers, with no disposal. Called once per variable in here
 * it leaked watchers on every theme change and every live-preview keystroke.
 */
function setVar(name: string, value: string | null) {
  if (value === null) {
    document.documentElement.style.removeProperty(name);
  } else {
    document.documentElement.style.setProperty(name, value);
  }
}

/**
 * Composable for managing application themes
 * Handles fetching, applying, and updating themes with live preview
 */
export function useTheme(options: UseThemeOptions = {}) {
  const {
    useThemesQuery,
    useActiveThemeQuery,
    useActivateThemeMutation,
    useCreateThemeMutation,
    useUpdateThemeMutation,
    useDeleteThemeMutation,
    useDuplicateThemeMutation,
  } = useQueries();

  // Store active theme ID in localStorage for instant load
  const activeThemeId = useLocalStorage<string | null>('active-theme-id', null);

  // Fetch all themes
  const { data: themes, isLoading: isLoadingThemes, error: themesError } = useThemesQuery();

  // Fetch active theme
  const {
    data: activeTheme,
    isLoading: isLoadingActiveTheme,
    error: activeThemeError,
  } = useActiveThemeQuery();

  // Update active theme ID when active theme changes
  watch(
    () => activeTheme.value?.id,
    newId => {
      if (newId) {
        activeThemeId.value = newId;
      }
    },
    { immediate: true }
  );

  // Get mutation hooks
  const activateThemeMutation = useActivateThemeMutation();
  const createThemeMutation = useCreateThemeMutation();
  const updateThemeMutation = useUpdateThemeMutation();
  const deleteThemeMutation = useDeleteThemeMutation();
  const duplicateThemeMutation = useDuplicateThemeMutation();

  /**
   * Apply a theme's CSS variables to the document
   * This is used for live preview and when activating themes
   */
  function applyThemeVariables(theme: Theme) {
    // Generate color palettes from base colors
    const primaryPalette = generateShades({
      baseColor: theme.primaryColor,
      algorithm: 'tailwind',
    });

    const secondaryPalette = generateShades({
      baseColor: theme.secondaryColor,
      algorithm: 'tailwind',
    });

    const tertiaryPalette = generateShades({
      baseColor: theme.tertiaryColor,
      algorithm: 'tailwind',
    });

    const slatePalette = generateShades({
      baseColor: theme.slateColor,
      algorithm: 'tailwind',
    });

    const successPalette = generateShades({
      baseColor: theme.successColor,
      algorithm: 'tailwind',
    });

    const dangerPalette = generateShades({
      baseColor: theme.dangerColor,
      algorithm: 'tailwind',
    });

    if (
      !primaryPalette ||
      !secondaryPalette ||
      !tertiaryPalette ||
      !slatePalette ||
      !successPalette ||
      !dangerPalette
    ) {
      console.error('Failed to generate color palettes');
      return;
    }

    // Apply the generated palettes
    const palettes = {
      primary: primaryPalette,
      secondary: secondaryPalette,
      tertiary: tertiaryPalette,
      slate: slatePalette,
      success: successPalette,
      danger: dangerPalette,
    };

    // Kept to hand to the inversion below. These are the light-mode values by
    // construction, which is exactly what it must not try to read back off an
    // element that may already be inverted.
    const lightPalette: Record<string, string> = {};

    for (const [name, palette] of Object.entries(palettes)) {
      palette.shades.forEach((shade, index) => {
        const varName = `--color-${name}-${TAILWIND_SHADES[index]}`;
        lightPalette[varName] = shade.hex;
        setVar(varName, shade.hex);
      });
    }

    // Apply border radius
    const radiusMap = {
      none: '0',
      sm: '0.375rem', // 6px
      md: '0.625rem', // 10px
      lg: '0.875rem', // 14px
      xl: '1.25rem', // 20px
    };
    setVar('--radius', radiusMap[theme.borderRadius]);

    // Apply font families. A theme with no font falls back to the stylesheet
    // default, which means removing the override rather than setting it empty.
    setVar('--font-ui', theme.fontUi ? `"${theme.fontUi}", sans-serif` : null);
    setVar('--font-heading', theme.fontHeading ? `"${theme.fontHeading}", sans-serif` : null);
    setVar('--font-code', theme.fontCode ? `"${theme.fontCode}", monospace` : null);

    // Apply custom CSS variables if any
    if (theme.customCssVars) {
      try {
        const customVars = JSON.parse(theme.customCssVars);
        for (const [varName, varValue] of Object.entries(customVars)) {
          setVar(varName, varValue as string);
        }
      } catch (error) {
        console.error('Failed to parse custom CSS variables:', error);
      }
    }

    // Everything above wrote light-mode values, so in dark mode the palette on
    // the element is now wrong. Re-invert here, synchronously, rather than
    // leaving it to a watcher somewhere else: this is the only point that knows
    // the writes have finished -- and the only one holding the light values.
    reinitializeColors(lightPalette);
  }

  /**
   * Live preview a theme without saving it as active
   * Useful for theme editor
   */
  function previewTheme(theme: Theme) {
    applyThemeVariables(theme);
  }

  /**
   * Apply the active theme when it loads or changes.
   *
   * Guarded because useTheme has six callers, and most only read activeTheme.
   * Every instance used to register this watcher with `immediate: true`, and
   * TanStack serves the cached theme synchronously, so merely mounting a
   * component that reads the theme re-ran applyThemeVariables -- repainting the
   * light palette. In dark mode that left the app half-inverted until something
   * else happened to re-invert it: navigating to /themes was enough.
   *
   * One owner claims it, so the apply happens once per actual change.
   */
  if (options.applyToDocument && !hasApplyOwner) {
    hasApplyOwner = true;

    watch(
      activeTheme,
      newTheme => {
        if (newTheme) {
          applyThemeVariables(newTheme);
        }
      },
      { immediate: true }
    );

    onScopeDispose(() => {
      hasApplyOwner = false;
    }, true);
  }

  return {
    // Queries
    themes: computed(() => themes.value ?? []),
    activeTheme: computed(() => activeTheme.value),
    isLoading: computed(() => isLoadingThemes.value || isLoadingActiveTheme.value),
    error: computed(() => themesError.value || activeThemeError.value),

    // Mutations
    activateTheme: activateThemeMutation.mutateAsync,
    createTheme: createThemeMutation.mutateAsync,
    updateTheme: updateThemeMutation.mutateAsync,
    deleteTheme: deleteThemeMutation.mutateAsync,
    duplicateTheme: duplicateThemeMutation.mutateAsync,

    // Utilities
    previewTheme,
    applyThemeVariables,
  };
}
