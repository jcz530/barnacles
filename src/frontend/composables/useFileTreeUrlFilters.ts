import { watch, type Ref } from 'vue';
import { useUrlSearchParams, useDebounceFn } from '@vueuse/core';
import type { FilterValue } from '@/utils/file-types';

export interface FileTreeFilters {
  searchQuery: Ref<string>;
  fileTypeFilters: Ref<FilterValue[]>;
  selectedFilePath: Ref<string | null>;
}

/**
 * Composable to synchronize file tree filter state with URL query parameters
 * This allows file tree filters and selection to persist across page reloads
 *
 * Uses VueUse's useUrlSearchParams for reactive URL management
 */
export function useFileTreeUrlFilters(filters: FileTreeFilters) {
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
    // File search query
    if (urlParams.fileSearch) {
      filters.searchQuery.value = String(urlParams.fileSearch);
    }

    // File type filters (comma-separated)
    if (urlParams.fileTypes) {
      const filterStrings = String(urlParams.fileTypes).split(',').filter(Boolean);
      filters.fileTypeFilters.value = filterStrings.map(filter => {
        // Handle both category and extension formats
        // Category: "category:image"
        // Extension: "extension:.js"
        if (filter.startsWith('category:')) {
          return {
            type: 'category' as const,
            value: filter.substring(9), // Remove "category:" prefix
          };
        } else if (filter.startsWith('extension:')) {
          return {
            type: 'extension' as const,
            value: filter.substring(10), // Remove "extension:" prefix
          };
        }
        // Fallback for old format (assume extension)
        return {
          type: 'extension' as const,
          value: filter,
        };
      });
    }

    // Selected file path
    if (urlParams.selectedFile) {
      filters.selectedFilePath.value = String(urlParams.selectedFile);
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

      // Clear all file tree params first
      const paramsToSet: Record<string, string | null> = {
        fileSearch: null,
        fileTypes: null,
        selectedFile: null,
      };

      // File search query
      if (filters.searchQuery.value.trim()) {
        paramsToSet.fileSearch = filters.searchQuery.value.trim();
      }

      // File type filters (serialize to comma-separated string)
      if (filters.fileTypeFilters.value.length > 0) {
        paramsToSet.fileTypes = filters.fileTypeFilters.value
          .map(filter => {
            // Prefix with type to distinguish categories from extensions
            return `${filter.type}:${filter.value}`;
          })
          .join(',');
      }

      // Selected file path
      if (filters.selectedFilePath.value) {
        paramsToSet.selectedFile = filters.selectedFilePath.value;
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
      [filters.fileTypeFilters, filters.selectedFilePath],
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
