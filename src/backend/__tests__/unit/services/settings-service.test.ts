import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createUnitTestContext, mockDatabaseForUnit } from '@test/contexts';
import { settingsService } from '@backend/services/settings-service';

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
});
