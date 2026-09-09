import { computed, ref, watch, type Ref } from 'vue';
import type { CommandContext, PaletteItem } from './types';

/** One pushed level: an item's actions, plus the search state that belongs to it. */
export interface Level {
  /** The id of the item drilled into, so the level can be rebuilt. */
  sourceId: string;
  /** Breadcrumb text -- the title of the item that was drilled into. */
  title: string;
  /** The drilled-into item's own icon, so the breadcrumb can show it. */
  projectIcon?: PaletteItem['projectIcon'];
  icon?: PaletteItem['icon'];
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
/**
 * Context for rebuilding a level's items.
 *
 * Providers use the context to build actions, not to run them -- running goes
 * back out through the component so the host supplies a real one -- so an inert
 * context is right here, and calling any of it would be a bug.
 */
const buildRefreshContext = (): CommandContext => ({
  surface: 'in-app',
  navigate: () => {},
  dismiss: () => {},
});

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

  /** What the footer shows for each open level, outermost first. */
  const breadcrumb = computed(() =>
    levels.value.map(level => ({
      title: level.title,
      projectIcon: level.projectIcon,
      icon: level.icon,
    }))
  );

  /**
   * Drill into an item's actions.
   *
   * Builds the actions now rather than at registry time, and does nothing when
   * an item has none, so callers can offer the gesture on every row without
   * checking first.
   *
   * The item's id is kept so the level can be rebuilt when the data behind it
   * changes -- see the watcher below.
   */
  const push = (item: PaletteItem, buildActions: () => PaletteItem[]): boolean => {
    if (!item.actions) return false;

    const items = buildActions();
    if (items.length === 0) return false;

    levels.value.push({
      sourceId: item.id,
      title: item.title,
      projectIcon: item.projectIcon,
      icon: item.icon,
      items,
      query: '',
      placeholder: `Search ${item.title.toLowerCase()} actions…`,
    });
    return true;
  };

  /**
   * Keep open levels in step with the data they were built from.
   *
   * A level holds the actions built at the moment it was opened, and ports
   * refetch every few seconds. Left alone, a picker sitting open across a
   * refresh would keep acting on what was true when it was opened -- and since
   * "kill port" closes over a pid, and pids get reused, that is not merely a
   * stale label.
   *
   * Rebuilding in place keeps the level where it is. A level whose subject has
   * gone entirely -- the port closed, the project was removed -- has nothing
   * left to act on, so it and everything under it are dropped.
   */
  watch(rootItems, items => {
    if (levels.value.length === 0) return;

    const rebuilt: Level[] = [];
    // Only the first level is anchored to a root item; deeper ones are actions
    // of actions, which are rebuilt from their parent as it is regenerated.
    let parents = items;

    for (const level of levels.value) {
      const source = parents.find(item => item.id === level.sourceId);
      const next = source?.actions?.(buildRefreshContext());

      if (!next || next.length === 0) break;

      rebuilt.push({
        ...level,
        title: source.title,
        projectIcon: source.projectIcon,
        icon: source.icon,
        items: next,
      });
      parents = next;
    }

    levels.value = rebuilt;
  });

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
