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
      '~/src',
      '~/dev',
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
      '.venv',
      'target',
    ]),
    type: 'json' as const,
  },
  showTrayIcon: { value: 'false', type: 'boolean' as const },
  // Off by default: a system-wide hotkey should be opted into, not sprung on
  // someone. Deliberately not Cmd+K, which the in-app palette uses -- a global
  // grab would swallow it before the renderer ever saw it.
  commandPaletteShortcut: { value: 'Alt+B', type: 'string' as const },
  commandPaletteShortcutEnabled: { value: 'false', type: 'boolean' as const },
  showDashboardStats: { value: 'true', type: 'boolean' as const },
  installCliCommand: { value: 'true', type: 'boolean' as const },
  gitEmails: { value: JSON.stringify([]), type: 'json' as const },
  mcpUsageLogging: { value: 'true', type: 'boolean' as const },
  mcpUsageRetentionDays: { value: '90', type: 'number' as const },
};

/** Thrown when a setting's value cannot be stored as its declared type. */
export class InvalidSettingValueError extends Error {}

/**
 * Coerce to a finite number, accepting only what is genuinely numeric.
 *
 * A positive type test rather than a denylist of bad spellings: `Number()`
 * turns `true` into 1, `[]` into 0 and `null` into 0, so screening particular
 * values let equivalents through -- `[]` produced the same depth-0 "scan finds
 * nothing" outcome that rejecting `''` was meant to prevent.
 */
function toFiniteNumber(key: string, value: unknown): number {
  const numeric =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : NaN;

  if (!Number.isFinite(numeric)) {
    throw new InvalidSettingValueError(
      `Setting "${key}" is numeric and requires a finite number; received ${JSON.stringify(value) ?? String(value)}.`
    );
  }

  return numeric;
}

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
    // `null` is never a legitimate stored value, and it is what an emptied
    // number input becomes on the wire: `v-model.number` yields NaN, and JSON
    // has no NaN literal so `JSON.stringify` sends null. Left alone it stored
    // as the string "null" under an inferred `json` type, corrupting the row's
    // type permanently and reading back as null or NaN.
    if (value === null || value === undefined) {
      throw new InvalidSettingValueError(
        `Setting "${key}" cannot be set to ${String(value)}. Provide a concrete value.`
      );
    }

    // Numbers are validated whether the type was declared or inferred. Only
    // checking the declared branch left the original bug intact: `setSetting`
    // with no `type` auto-detects `typeof NaN === 'number'` and stored "NaN",
    // which reads back as NaN -- and every `depth > NaN` comparison is false,
    // so scanning silently found nothing.
    const wantsNumber = type === 'number' || (type === undefined && typeof value === 'number');

    // Auto-detect type if not provided
    let inferredType = type;
    let stringValue: string;

    if (wantsNumber) {
      inferredType = 'number';
      stringValue = String(toFiniteNumber(key, value));
    } else if (type === undefined) {
      if (typeof value === 'boolean') {
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

    const { value } = defaultSetting;

    switch (defaultSetting.type) {
      case 'number':
        return Number(value) as T;
      case 'boolean':
        return (value === 'true') as T;
      case 'json':
        return JSON.parse(value) as T;
      default:
        return value as T;
    }
  }

  /**
   * Get all default settings
   */
  getDefaultSettings(): Record<string, unknown> {
    const defaults: Record<string, unknown> = {};
    for (const [key] of Object.entries(DEFAULT_SETTINGS)) {
      defaults[key] = this.getDefaultValue(key);
    }
    return defaults;
  }
}

export const settingsService = new SettingsService();
