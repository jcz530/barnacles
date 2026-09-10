import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createUnitTestContext, mockDatabaseForUnit } from '@test/contexts';
import { settingsService, InvalidSettingValueError } from '@backend/services/settings-service';

// Mock the database connection module
mockDatabaseForUnit();

describe('SettingsService', () => {
  const context = createUnitTestContext();

  beforeEach(async () => {
    await context.setup();
  });

  afterEach(async () => {
    await context.teardown();
  });

  describe('getSetting', () => {
    it('should return null for non-existent setting without default', async () => {
      const result = await settingsService.getSetting('nonExistentKey');
      expect(result).toBeNull();
    });

    it('should return default value for non-existent setting with default', async () => {
      const result = await settingsService.getSetting('scanMaxDepth');
      expect(result).not.toBeNull();
      expect(result?.key).toBe('scanMaxDepth');
      expect(result?.value).toBe('3');
      expect(result?.type).toBe('number');
    });

    it('should return stored setting value', async () => {
      // Set a setting
      await settingsService.setSetting('testKey', 'testValue');

      // Get the setting
      const result = await settingsService.getSetting('testKey');
      expect(result).not.toBeNull();
      expect(result?.key).toBe('testKey');
      expect(result?.value).toBe('testValue');
      expect(result?.type).toBe('string');
    });
  });

  describe('setSetting', () => {
    it('should create a new string setting', async () => {
      const result = await settingsService.setSetting('myKey', 'myValue');

      expect(result.key).toBe('myKey');
      expect(result.value).toBe('myValue');
      expect(result.type).toBe('string');

      // Verify it was stored
      const retrieved = await settingsService.getSetting('myKey');
      expect(retrieved?.value).toBe('myValue');
    });

    it('should create a new number setting', async () => {
      const result = await settingsService.setSetting('numberKey', 42);

      expect(result.key).toBe('numberKey');
      expect(result.value).toBe('42');
      expect(result.type).toBe('number');

      // Verify getValue returns typed value
      const value = await settingsService.getValue<number>('numberKey');
      expect(value).toBe(42);
    });

    it('should create a new boolean setting', async () => {
      const result = await settingsService.setSetting('boolKey', true);

      expect(result.key).toBe('boolKey');
      expect(result.value).toBe('true');
      expect(result.type).toBe('boolean');

      // Verify getValue returns typed value
      const value = await settingsService.getValue<boolean>('boolKey');
      expect(value).toBe(true);
    });

    it('should create a new json setting', async () => {
      const jsonData = { foo: 'bar', nested: { value: 123 } };
      const result = await settingsService.setSetting('jsonKey', jsonData);

      expect(result.key).toBe('jsonKey');
      expect(result.type).toBe('json');

      // Verify getValue returns typed value
      const value = await settingsService.getValue<typeof jsonData>('jsonKey');
      expect(value).toEqual(jsonData);
    });

    it('should update existing setting', async () => {
      // Create initial setting
      await settingsService.setSetting('updateKey', 'initial');

      // Update the setting
      await settingsService.setSetting('updateKey', 'updated');

      // Verify it was updated
      const result = await settingsService.getSetting('updateKey');
      expect(result?.value).toBe('updated');
    });
  });

  describe('getAllSettings', () => {
    it('should return all stored settings merged with defaults', async () => {
      // Create a custom setting
      await settingsService.setSetting('customKey', 'customValue');

      const allSettings = await settingsService.getAllSettings();

      // Should include our custom setting
      const customSetting = allSettings.find(s => s.key === 'customKey');
      expect(customSetting).toBeDefined();
      expect(customSetting?.value).toBe('customValue');

      // Should also include default settings
      const defaultSetting = allSettings.find(s => s.key === 'scanMaxDepth');
      expect(defaultSetting).toBeDefined();
      expect(defaultSetting?.value).toBe('3');
    });
  });

  describe('deleteSetting', () => {
    it('should delete a setting', async () => {
      // Create a setting
      await settingsService.setSetting('deleteMe', 'value');

      // Verify it exists
      let result = await settingsService.getSetting('deleteMe');
      expect(result).not.toBeNull();

      // Delete it
      await settingsService.deleteSetting('deleteMe');

      // Verify it's gone
      result = await settingsService.getSetting('deleteMe');
      expect(result).toBeNull();
    });
  });

  describe('resetToDefaults', () => {
    it('should clear all settings from database', async () => {
      // Create some settings
      await settingsService.setSetting('key1', 'value1');
      await settingsService.setSetting('key2', 'value2');

      // Reset to defaults
      await settingsService.resetToDefaults();

      // Custom settings should be gone
      const key1 = await settingsService.getSetting('key1');
      expect(key1).toBeNull();

      // But defaults should still be accessible
      const allSettings = await settingsService.getAllSettings();
      const defaultSetting = allSettings.find(s => s.key === 'scanMaxDepth');
      expect(defaultSetting).toBeDefined();
    });
  });

  describe('getDefaultValue', () => {
    it('should return default value for known setting', async () => {
      const value = settingsService.getDefaultValue<number>('scanMaxDepth');
      expect(value).toBe(3);
    });

    it('should return null for unknown setting', async () => {
      const value = settingsService.getDefaultValue('unknownKey');
      expect(value).toBeNull();
    });
  });

  describe('numeric setting validation', () => {
    // An emptied `v-model.number` input yields NaN, which JSON.stringify turns
    // into null on the wire. String(null) stored "null", which read back as
    // NaN -- and `depth > NaN` is false, so scans silently found nothing.
    it('rejects null for a number-typed setting', async () => {
      await expect(
        settingsService.setSetting('scanMaxDepth', null as never, 'number')
      ).rejects.toBeInstanceOf(InvalidSettingValueError);
    });

    it('rejects NaN for a number-typed setting', async () => {
      await expect(
        settingsService.setSetting('scanMaxDepth', NaN, 'number')
      ).rejects.toBeInstanceOf(InvalidSettingValueError);
    });

    it('rejects a non-numeric string for a number-typed setting', async () => {
      await expect(
        settingsService.setSetting('scanMaxDepth', 'abc', 'number')
      ).rejects.toBeInstanceOf(InvalidSettingValueError);
    });

    // Number(null) and Number('') are both 0, so a coercion-only guard would
    // store a real depth of 0 -- a scan that finds nothing.
    it('rejects an empty string rather than coercing it to 0', async () => {
      await expect(settingsService.setSetting('scanMaxDepth', '', 'number')).rejects.toBeInstanceOf(
        InvalidSettingValueError
      );
    });

    // The declared-type branch was guarded first; auto-detect was not, which
    // left the original bug fully intact for any caller that omits `type`.
    it('rejects NaN when the type is inferred rather than declared', async () => {
      await expect(settingsService.setSetting('scanMaxDepth', NaN)).rejects.toBeInstanceOf(
        InvalidSettingValueError
      );
    });

    it('rejects null when the type is inferred rather than declared', async () => {
      await expect(
        settingsService.setSetting('scanMaxDepth', null as never)
      ).rejects.toBeInstanceOf(InvalidSettingValueError);
    });

    // Without a declared type, null used to infer `json` and store "null",
    // corrupting the row's type so later reads went through JSON.parse.
    it('does not corrupt the stored type when a bad value is rejected', async () => {
      await settingsService.setSetting('scanMaxDepth', 5, 'number');
      await expect(
        settingsService.setSetting('scanMaxDepth', null as never)
      ).rejects.toBeInstanceOf(InvalidSettingValueError);

      const raw = await settingsService.getSetting('scanMaxDepth');
      expect(raw?.type).toBe('number');
      expect(raw?.value).toBe('5');
    });

    // Number() maps all of these onto plausible-looking numbers, so a denylist
    // of "empty-ish" spellings let them through: [] and true both coerce.
    it.each([
      ['a boolean true', true],
      ['a boolean false', false],
      ['an empty array', []],
      ['a single-element array', [5]],
      ['an object', {}],
      ['a whitespace-only string', '   '],
    ])('rejects %s for a number-typed setting', async (_label, value) => {
      await expect(
        settingsService.setSetting('scanMaxDepth', value as never, 'number')
      ).rejects.toBeInstanceOf(InvalidSettingValueError);
    });

    it('accepts a numeric string with surrounding whitespace', async () => {
      await settingsService.setSetting('scanMaxDepth', ' 5 ', 'number');
      expect(await settingsService.getValue<number>('scanMaxDepth')).toBe(5);
    });

    it('rejects Infinity for a number-typed setting', async () => {
      await expect(
        settingsService.setSetting('scanMaxDepth', Infinity, 'number')
      ).rejects.toBeInstanceOf(InvalidSettingValueError);
    });

    it('leaves the previous value intact when a write is rejected', async () => {
      await settingsService.setSetting('scanMaxDepth', 5, 'number');
      await expect(
        settingsService.setSetting('scanMaxDepth', null as never, 'number')
      ).rejects.toBeInstanceOf(InvalidSettingValueError);

      const value = await settingsService.getValue<number>('scanMaxDepth');
      expect(value).toBe(5);
    });

    it('still accepts a numeric string, coerced to a number', async () => {
      const setting = await settingsService.setSetting('scanMaxDepth', '4', 'number');
      expect(setting.value).toBe('4');
      expect(await settingsService.getValue<number>('scanMaxDepth')).toBe(4);
    });

    it('accepts a normal number', async () => {
      await settingsService.setSetting('scanMaxDepth', 7, 'number');
      expect(await settingsService.getValue<number>('scanMaxDepth')).toBe(7);
    });
  });
});
