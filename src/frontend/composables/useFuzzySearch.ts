import { useFuse, type UseFuseOptions } from '@vueuse/integrations/useFuse';
import { computed, type MaybeRefOrGetter, toValue } from 'vue';

interface UseFuzzySearchOptions<T> {
  /**
   * Array of items to search through
   */
  items: MaybeRefOrGetter<T[]>;
  /**
   * Search query string
   */
  searchQuery: MaybeRefOrGetter<string>;
  /**
   * Fuse.js options
   */
  fuseOptions?: UseFuseOptions<T>['fuseOptions'];
}

/**
 * Generic composable for fuzzy searching through any array of items using Fuse.js
 * @param options Configuration options for fuzzy search
 * @returns Object containing filtered results
 */
export function useFuzzySearch<T>(options: UseFuzzySearchOptions<T>) {
  const { items, searchQuery, fuseOptions = {} } = options;

  // Use VueUse's useFuse integration
  const { results } = useFuse(searchQuery, items, {
    fuseOptions,
  });

  // Extract the actual items from Fuse results
  const filteredItems = computed(() => {
    const query = toValue(searchQuery);

    // If no search query, return all items
    if (!query || query.trim() === '') {
      return toValue(items);
    }

    // Return matched items from Fuse results
    return results.value.map(result => result.item);
  });

  return {
    filteredItems,
    results,
  };
}
