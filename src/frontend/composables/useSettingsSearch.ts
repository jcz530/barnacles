import { computed, ref } from 'vue';
import { ALL_SETTINGS, SETTINGS_SECTIONS, type FlatSettingDef } from '@/constants/settings';
import { useFuzzySearch } from '@/composables/useFuzzySearch';

/**
 * The settings search query, shared between the settings sidebar and the
 * settings page.
 *
 * Module-level rather than provide/inject, matching `useCommandPaletteState`:
 * the two consumers sit on opposite sides of `DefaultLayout`, so threading a
 * prop between them would mean routing settings state through the shared
 * layout that every other page also uses.
 */
const query = ref('');

const { filteredItems } = useFuzzySearch<FlatSettingDef>({
  items: ALL_SETTINGS,
  searchQuery: query,
  fuseOptions: {
    keys: ['label', 'description', 'keywords', 'sectionTitle'],
    threshold: 0.4,
  },
});

const isSearching = computed(() => query.value.trim() !== '');

/** Keys of the settings matching the current query, for O(1) lookup while rendering. */
const matchingKeys = computed(() => new Set(filteredItems.value.map(setting => setting.key)));

/**
 * Sections that still have at least one visible setting, each carrying only its
 * matching settings. Drives both the filtered sidebar and the filtered page, so
 * the two can never disagree about what a search matched.
 */
const visibleSections = computed(() =>
  SETTINGS_SECTIONS.map(section => ({
    ...section,
    settings: section.settings.filter(setting => matchingKeys.value.has(setting.key)),
  })).filter(section => section.settings.length > 0)
);

const hasResults = computed(() => visibleSections.value.length > 0);

/**
 * The best match for the current query, for Enter-to-jump.
 *
 * Taken from the Fuse results rather than the first row of `visibleSections`:
 * those are rebuilt in registry order, which would send Enter to whichever
 * match happens to sit highest on the page instead of the one the ranking
 * considers closest to what was typed.
 */
const firstMatch = computed(() => (isSearching.value ? (filteredItems.value[0] ?? null) : null));

export function useSettingsSearch() {
  function clear() {
    query.value = '';
  }

  return {
    query,
    isSearching,
    visibleSections,
    hasResults,
    firstMatch,
    clear,
  };
}
