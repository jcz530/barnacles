import { useLocalStorage } from '@vueuse/core';
import type { Ref } from 'vue';

/**
 * Composable for managing and persisting view mode preference
 * Stores the user's preference for table or card view in localStorage
 *
 * @param key - Unique key for the view mode preference (e.g., 'projects-view-mode', 'users-view-mode')
 * @param defaultValue - Default view mode if none is stored (defaults to 'table')
 * @returns Reactive ref to the current view mode
 */
export function useViewMode(
  key: string,
  defaultValue: 'table' | 'card' = 'table'
): Ref<'table' | 'card'> {
  return useLocalStorage<'table' | 'card'>(key, defaultValue);
}
