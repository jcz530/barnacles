import { describe, it, expect, beforeEach } from 'vitest';
import { useSettingsSearch } from './useSettingsSearch';
import { SETTING_KEYS } from '../../shared/types/api';

/*
 * The composable holds module-level state, so every test starts from a cleared
 * query rather than inheriting the one before it.
 */
describe('useSettingsSearch', () => {
  beforeEach(() => {
    useSettingsSearch().clear();
  });

  it('shows every section when nothing is typed', () => {
    const { isSearching, visibleSections, firstMatch } = useSettingsSearch();

    expect(isSearching.value).toBe(false);
    expect(visibleSections.value.length).toBeGreaterThan(1);
    // Nothing is "the match" until something is searched for.
    expect(firstMatch.value).toBeNull();
  });

  it('narrows to the sections holding a match', () => {
    const { query, isSearching, visibleSections } = useSettingsSearch();
    query.value = 'tray';

    expect(isSearching.value).toBe(true);
    const keys = visibleSections.value.flatMap(section => section.settings.map(s => s.key));
    expect(keys).toContain(SETTING_KEYS.SHOW_TRAY_ICON);
    // A section whose settings all filtered out must not linger as an empty heading.
    expect(visibleSections.value.every(section => section.settings.length > 0)).toBe(true);
  });

  it('points firstMatch at the setting that was searched for', () => {
    const { query, firstMatch } = useSettingsSearch();
    query.value = 'tray icon';

    expect(firstMatch.value?.key).toBe(SETTING_KEYS.SHOW_TRAY_ICON);
    // Enter needs the section too, to scroll to the right place.
    expect(firstMatch.value?.sectionId).toBe('appearance');
  });

  it('matches on keywords that are not in the visible label', () => {
    const { query, visibleSections } = useSettingsSearch();
    // "menu bar" is a keyword on the tray setting, not part of its label.
    query.value = 'menu bar';

    const keys = visibleSections.value.flatMap(section => section.settings.map(s => s.key));
    expect(keys).toContain(SETTING_KEYS.SHOW_TRAY_ICON);
  });

  it('reports no results for a query nothing matches', () => {
    const { query, hasResults, visibleSections, firstMatch } = useSettingsSearch();
    query.value = 'zzzznotasetting';

    expect(hasResults.value).toBe(false);
    expect(visibleSections.value).toEqual([]);
    expect(firstMatch.value).toBeNull();
  });

  it('restores every section when the query is cleared', () => {
    const { query, clear, isSearching, hasResults, visibleSections } = useSettingsSearch();
    query.value = 'tray';
    const narrowed = visibleSections.value.length;

    clear();

    expect(isSearching.value).toBe(false);
    expect(hasResults.value).toBe(true);
    expect(visibleSections.value.length).toBeGreaterThan(narrowed);
  });

  it('treats a whitespace-only query as no search', () => {
    const { query, isSearching } = useSettingsSearch();
    query.value = '   ';

    expect(isSearching.value).toBe(false);
  });
});
