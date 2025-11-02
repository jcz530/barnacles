import { useCssVar } from '@vueuse/core';
import { computed, watch } from 'vue';
import { useLocalStorage } from '@vueuse/core';
import { generateShades } from '../../shared/utilities/shade-generator';
import type { Theme } from '../../shared/types/theme';
import { useQueries } from './useQueries';

const TAILWIND_SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

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

    const slatePalette = generateShades({
      baseColor: theme.slateColor,
      algorithm: 'tailwind',
    });

    if (!primaryPalette || !slatePalette) {
      console.error('Failed to generate color palettes');
      return;
    }

    // Apply primary color palette
    primaryPalette.shades.forEach((shade, index) => {
      const shadeName = TAILWIND_SHADES[index];
      const cssVar = useCssVar(`--color-primary-${shadeName}`, document.documentElement);
      cssVar.value = shade.hex;
    });

    // Apply slate color palette
    slatePalette.shades.forEach((shade, index) => {
      const shadeName = TAILWIND_SHADES[index];
      const cssVar = useCssVar(`--color-slate-${shadeName}`, document.documentElement);
      cssVar.value = shade.hex;
    });

    // Apply border radius
    const radiusMap = {
      none: '0',
      sm: '0.375rem', // 6px
      md: '0.625rem', // 10px
      lg: '0.875rem', // 14px
      xl: '1.25rem', // 20px
    };
    const radiusCssVar = useCssVar('--radius', document.documentElement);
    radiusCssVar.value = radiusMap[theme.borderRadius];

    // Apply shadow intensity (using MDC shadow scale)
    // shadowIntensity ranges from 0-6 mapping to shadow-2xs through shadow-2xl
    // For now, we'll just store it as a custom property
    const shadowIntensityCssVar = useCssVar('--shadow-intensity', document.documentElement);
    shadowIntensityCssVar.value = String(theme.shadowIntensity);

    // Apply custom CSS variables if any
    if (theme.customCssVars) {
      try {
        const customVars = JSON.parse(theme.customCssVars);
        for (const [varName, varValue] of Object.entries(customVars)) {
          const cssVar = useCssVar(varName, document.documentElement);
          cssVar.value = varValue as string;
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
