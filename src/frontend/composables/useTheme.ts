import { computed, watch } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import { generateShades } from '../../shared/utilities/shade-generator';
import type { Theme } from '../../shared/types/theme';
import { useQueries } from './useQueries';

const TAILWIND_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

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
export function useTheme() {
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

    for (const [name, palette] of Object.entries(palettes)) {
      palette.shades.forEach((shade, index) => {
        setVar(`--color-${name}-${TAILWIND_SHADES[index]}`, shade.hex);
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
  }

  /**
   * Live preview a theme without saving it as active
   * Useful for theme editor
   */
  function previewTheme(theme: Theme) {
    applyThemeVariables(theme);
  }

  // Apply active theme when it loads or changes
  watch(
    activeTheme,
    newTheme => {
      if (newTheme) {
        applyThemeVariables(newTheme);
      }
    },
    { immediate: true }
  );

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
