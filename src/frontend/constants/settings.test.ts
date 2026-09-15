import { describe, it, expect } from 'vitest';
import { SETTINGS_SECTIONS, ALL_SETTINGS } from './settings';
import { SETTING_KEYS } from '../../shared/types/api';

/**
 * Settings keys that intentionally have no entry in the registry, because
 * neither is a row you can navigate to -- each is a secondary control living
 * inside another setting.
 */
const KEYS_WITHOUT_OWN_ROW: string[] = [
  SETTING_KEYS.COMMAND_PALETTE_SHORTCUT_ENABLED, // toggle inside CommandPaletteShortcutSetting
  SETTING_KEYS.MCP_USAGE_RETENTION_DAYS, // dropdown inside McpUsageLoggingSetting
];

describe('settings registry', () => {
  it('covers every setting key that has a row of its own', () => {
    const registered = new Set(ALL_SETTINGS.map(setting => setting.key));
    const expected = Object.values(SETTING_KEYS).filter(key => !KEYS_WITHOUT_OWN_ROW.includes(key));

    // Fails when a new key is added to SETTING_KEYS without being placed in a
    // section -- which would otherwise mean a setting that renders but can
    // never be found by search or reached from the sidebar.
    expect([...registered].sort()).toEqual([...expected].sort());
  });

  it('references only real setting keys', () => {
    const valid = new Set<string>(Object.values(SETTING_KEYS));
    for (const setting of ALL_SETTINGS) {
      expect(valid.has(setting.key)).toBe(true);
    }
  });

  it('gives every section and setting a unique id', () => {
    const sectionIds = SETTINGS_SECTIONS.map(section => section.id);
    expect(new Set(sectionIds).size).toBe(sectionIds.length);

    const keys = ALL_SETTINGS.map(setting => setting.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('tags each flattened setting with the section that owns it', () => {
    for (const section of SETTINGS_SECTIONS) {
      for (const setting of section.settings) {
        const flat = ALL_SETTINGS.find(item => item.key === setting.key);
        expect(flat?.sectionId).toBe(section.id);
        expect(flat?.sectionTitle).toBe(section.title);
      }
    }
  });

  it('gives every section a url-safe anchor id', () => {
    for (const section of SETTINGS_SECTIONS) {
      // Anchor ids end up in the URL fragment and as scroll-spy keys.
      expect(section.id).toMatch(/^[a-z0-9-]+$/);
    }
  });
});
