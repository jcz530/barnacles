import { db } from '../../shared/database/connection';
import { settings } from '../../shared/database/schema';
import { eq } from 'drizzle-orm';

export interface Setting {
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  updatedAt: Date;
}

// Default settings
const DEFAULT_SETTINGS = {
  scanMaxDepth: { value: '3', type: 'number' as const },
  scanIncludedDirectories: {
    value: JSON.stringify([
      '~/Development',
      '~/Projects',
      '~/Code',
      '~/workspace',
      '~/Documents/Projects',
    ]),
    type: 'json' as const,
  },
  scanExcludedDirectories: {
    value: JSON.stringify([
      'node_modules',
      '.git',
      'vendor',
      'dist',
      'build',
      '.next',
      '.nuxt',
      '__pycache__',
      'venv',
      'target',
    ]),
    type: 'json' as const,
  },
  // Add more default settings here as needed
};

class SettingsService {
  /**
   * Get a setting by key
   */
  async getSetting(key: string): Promise<Setting | null> {
    const result = await db.select().from(settings).where(eq(settings.key, key)).limit(1);

    if (result.length === 0) {
      // Return default if exists
      const defaultSetting = DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS];
      if (defaultSetting) {
        return {
          key,
          value: defaultSetting.value,
          type: defaultSetting.type,
          updatedAt: new Date(),
        };
      }
      return null;
    }

    return result[0] as Setting;
  }

  /**
   * Get a setting value with type conversion
   */
  async getValue<T = string>(key: string): Promise<T | null> {
    const setting = await this.getSetting(key);
    if (!setting) return null;

    switch (setting.type) {
      case 'number':
        return Number(setting.value) as T;
      case 'boolean':
        return (setting.value === 'true') as T;
      case 'json':
        return JSON.parse(setting.value) as T;
      default:
        return setting.value as T;
    }
  }

  /**
   * Get all settings
   */
  async getAllSettings(): Promise<Setting[]> {
    const result = await db.select().from(settings);

    // Merge with defaults for any missing settings
    const settingsMap = new Map(result.map(s => [s.key, s as Setting]));

    for (const [key, defaultSetting] of Object.entries(DEFAULT_SETTINGS)) {
      if (!settingsMap.has(key)) {
        settingsMap.set(key, {
          key,
          value: defaultSetting.value,
          type: defaultSetting.type,
          updatedAt: new Date(),
        });
      }
    }

    return Array.from(settingsMap.values());
  }

  /**
   * Set a setting value
   */
  async setSetting(
    key: string,
    value: string | number | boolean | object,
    type?: 'string' | 'number' | 'boolean' | 'json'
  ): Promise<Setting> {
    // Auto-detect type if not provided
    let inferredType = type;
    let stringValue: string;

    if (type === undefined) {
      if (typeof value === 'number') {
        inferredType = 'number';
        stringValue = String(value);
      } else if (typeof value === 'boolean') {
        inferredType = 'boolean';
        stringValue = String(value);
      } else if (typeof value === 'object') {
        inferredType = 'json';
        stringValue = JSON.stringify(value);
      } else {
        inferredType = 'string';
        stringValue = String(value);
      }
    } else {
      // Use provided type and convert value accordingly
      if (type === 'json') {
        stringValue = JSON.stringify(value);
      } else {
        stringValue = String(value);
      }
    }

    const now = new Date();

    await db
      .insert(settings)
      .values({
        key,
        value: stringValue,
        type: inferredType,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          value: stringValue,
          type: inferredType,
          updatedAt: now,
        },
      });

    return {
      key,
      value: stringValue,
      type: inferredType,
      updatedAt: now,
    };
  }

  /**
   * Delete a setting
   */
  async deleteSetting(key: string): Promise<void> {
    await db.delete(settings).where(eq(settings.key, key));
  }

  /**
   * Reset all settings to defaults
   */
  async resetToDefaults(): Promise<void> {
    await db.delete(settings);
  }

  /**
   * Get default value for a setting
   */
  getDefaultValue<T = string>(key: string): T | null {
    const defaultSetting = DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS];
    if (!defaultSetting) return null;

    switch (defaultSetting.type) {
      case 'number':
        return Number(defaultSetting.value) as T;
      case 'boolean':
        return (defaultSetting.value === 'true') as T;
      case 'json':
        return JSON.parse(defaultSetting.value) as T;
      default:
        return defaultSetting.value as T;
    }
  }

  /**
   * Get all default settings
   */
  getDefaultSettings(): Record<string, unknown> {
    const defaults: Record<string, unknown> = {};
    for (const [key, setting] of Object.entries(DEFAULT_SETTINGS)) {
      defaults[key] = this.getDefaultValue(key);
    }
    return defaults;
  }
}

export const settingsService = new SettingsService();
