import { computed, ref, type Ref } from 'vue';
import type { PaletteItem } from './types';

/** One pushed level: an item's actions, plus the search state that belongs to it. */
export interface Level {
  /** Breadcrumb text -- the title of the item that was drilled into. */
  title: string;
  items: PaletteItem[];
  /** Saved per level so backing out restores what was typed there. */
  query: string;
  placeholder?: string;
}

/**
 * The palette's navigation stack.
 *
 * Deliberately a composable rather than component state: the renderer's test
 * environment has no DOM, so logic left inside the .vue file cannot be tested
 * at all. This holds everything worth asserting on -- what a level shows, what
 * pushing and popping do to the query -- and the component keeps only the
 * reka-ui wiring.
 */
export const useLevelStack = (rootItems: Ref<PaletteItem[]>) => {
  const levels = ref<Level[]>([]);
  const rootQuery = ref('');

  const depth = computed(() => levels.value.length);
  const current = computed<Level | undefined>(() => levels.value[levels.value.length - 1]);

  /** The items being searched: the deepest level's, or the root list. */
  const activeItems = computed<PaletteItem[]>(() => current.value?.items ?? rootItems.value);

  /**
   * The query for wherever we are.
   *
   * Writable, and stored on the level itself, so pushing starts a fresh search
   * and popping restores the one that was interrupted -- without the component
   * having to save and reinstate anything.
   */
  const activeQuery = computed<string>({
    get: () => current.value?.query ?? rootQuery.value,
    set: value => {
      const level = current.value;
      if (level) level.query = value;
      else rootQuery.value = value;
    },
  });

  const placeholder = computed(() => current.value?.placeholder);

  /** Level titles, outermost first, for the footer. */
  const breadcrumb = computed(() => levels.value.map(level => level.title));

  /**
   * Drill into an item's actions.
   *
   * Builds the actions now rather than at registry time, and does nothing when
   * an item has none, so callers can offer the gesture on every row without
   * checking first.
   */
  const push = (item: PaletteItem, buildActions: () => PaletteItem[]): boolean => {
    if (!item.actions) return false;

    const items = buildActions();
    if (items.length === 0) return false;

    levels.value.push({
      title: item.title,
      items,
      query: '',
      placeholder: `Search ${item.title.toLowerCase()} actions…`,
    });
    return true;
  };

  /** Back out one level. False at the root, where the caller should dismiss. */
  const pop = (): boolean => {
    if (levels.value.length === 0) return false;
    levels.value.pop();
    return true;
  };

  /** Back to the root with an empty search, for a fresh open. */
  const reset = () => {
    levels.value = [];
    rootQuery.value = '';
  };

  return {
    levels,
    depth,
    activeItems,
    activeQuery,
    placeholder,
    breadcrumb,
    push,
    pop,
    reset,
  };
};
