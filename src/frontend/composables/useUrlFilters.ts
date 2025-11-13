import { watch, type Ref } from 'vue';
import { useUrlSearchParams, useDebounceFn } from '@vueuse/core';
import type { DateFilterDirection, DatePreset } from '../components/molecules/DateFilter.vue';

export interface ProjectFilters {
  searchQuery: Ref<string>;
  selectedTechnologies: Ref<string[]>;
  showFavoritesOnly: Ref<boolean>;
  datePreset: Ref<DatePreset>;
  dateDirection: Ref<DateFilterDirection>;
  sortField: Ref<'name' | 'lastModified' | 'size'>;
  sortDirection: Ref<'asc' | 'desc'>;
  viewMode?: Ref<'table' | 'card'>;
}

/**
 * Composable to synchronize filter state with URL query parameters
 * This allows filters to persist across page reloads and enables sharing filtered views
 *
 * Uses VueUse's useUrlSearchParams for reactive URL management
 */
export function useUrlFilters(filters: ProjectFilters) {
  // Get reactive URL search params
  const urlParams = useUrlSearchParams('history', {
    removeNullishValues: true,
    removeFalsyValues: false,
    write: true, // Auto-write enabled
    writeMode: 'replace', // Use replaceState instead of pushState
  });

  // Track initialization state
  let isInitialized = false;

  /**
   * Initialize filters from URL parameters on mount (read once)
   */
  const initializeFromUrl = () => {
    // Search query
    if (urlParams.search) {
      filters.searchQuery.value = String(urlParams.search);
    }

    // Technologies (comma-separated)
    if (urlParams.technologies) {
      filters.selectedTechnologies.value = String(urlParams.technologies)
        .split(',')
        .filter(Boolean);
    }

    // Favorites
    if (urlParams.favorites === 'true') {
      filters.showFavoritesOnly.value = true;
    }

    // Date preset
    if (urlParams.datePreset) {
      const datePreset = String(urlParams.datePreset);
      const validPresets: DatePreset[] = ['all', 'today', 'week', 'month', 'quarter', 'year'];
      if (validPresets.includes(datePreset as DatePreset)) {
        filters.datePreset.value = datePreset as DatePreset;
      }
    }

    // Date direction
    if (urlParams.dateDirection) {
      const dateDirection = String(urlParams.dateDirection);
      if (dateDirection === 'within' || dateDirection === 'older') {
        filters.dateDirection.value = dateDirection;
      }
    }

    // Sort field
    if (urlParams.sortField) {
      const sortField = String(urlParams.sortField);
      const validFields = ['name', 'lastModified', 'size'];
      if (validFields.includes(sortField)) {
        filters.sortField.value = sortField as 'name' | 'lastModified' | 'size';
      }
    }

    // Sort direction
    if (urlParams.sortDirection) {
      const sortDirection = String(urlParams.sortDirection);
      if (sortDirection === 'asc' || sortDirection === 'desc') {
        filters.sortDirection.value = sortDirection;
      }
    }

    // View mode (optional)
    if (urlParams.view && filters.viewMode) {
      const view = String(urlParams.view);
      if (view === 'table' || view === 'card') {
        filters.viewMode.value = view;
      }
    }

    // Mark as initialized
    isInitialized = true;
  };

  /**
   * Update URL when filters change (write directly to urlParams)
   */
  const syncFiltersToUrl = () => {
    // Helper function to update URL params
    const updateUrlParams = () => {
      if (!isInitialized) return; // Don't update URL during initialization

      // Clear all params first (only include non-default values)
      const paramsToSet: Record<string, string | null> = {
        search: null,
        technologies: null,
        favorites: null,
        datePreset: null,
        dateDirection: null,
        sortField: null,
        sortDirection: null,
        view: null,
      };

      // Search query
      if (filters.searchQuery.value.trim()) {
        paramsToSet.search = filters.searchQuery.value.trim();
      }

      // Technologies (comma-separated)
      if (filters.selectedTechnologies.value.length > 0) {
        paramsToSet.technologies = filters.selectedTechnologies.value.join(',');
      }

      // Favorites
      if (filters.showFavoritesOnly.value) {
        paramsToSet.favorites = 'true';
      }

      // Date preset and direction
      if (filters.datePreset.value !== 'all') {
        paramsToSet.datePreset = filters.datePreset.value;
        paramsToSet.dateDirection = filters.dateDirection.value;
      }

      // Sort field and direction (only if not default)
      if (filters.sortField.value !== 'lastModified' || filters.sortDirection.value !== 'desc') {
        paramsToSet.sortField = filters.sortField.value;
        paramsToSet.sortDirection = filters.sortDirection.value;
      }

      // View mode (only if not default)
      if (filters.viewMode && filters.viewMode.value !== 'table') {
        paramsToSet.view = filters.viewMode.value;
      }

      // Update all URL params at once
      Object.entries(paramsToSet).forEach(([key, value]) => {
        if (value === null) {
          delete urlParams[key];
        } else {
          urlParams[key] = value;
        }
      });
    };

    // Debounced function for search query updates
    const updateUrlDebounced = useDebounceFn(() => {
      updateUrlParams();
    }, 300);

    // Watch search query with debounce to avoid losing focus while typing
    watch(filters.searchQuery, () => {
      updateUrlDebounced();
    });

    // Watch other filters without debounce for immediate updates
    watch(
      [
        filters.selectedTechnologies,
        filters.showFavoritesOnly,
        filters.datePreset,
        filters.dateDirection,
        filters.sortField,
        filters.sortDirection,
        ...(filters.viewMode ? [filters.viewMode] : []),
      ],
      () => {
        updateUrlParams();
      },
      { deep: true }
    );
  };

  return {
    initializeFromUrl,
    syncFiltersToUrl,
  };
}
