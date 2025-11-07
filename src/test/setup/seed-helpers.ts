import { settings, themes, aliasThemes } from '@shared/database/schema';
import type { DB } from '@shared/database';

/**
 * Seeds default settings for testing
 */
export async function seedDefaultSettings(db: DB) {
  await db.insert(settings).values([
    { key: 'theme', value: 'system', type: 'string' },
    { key: 'scanOnStartup', value: 'true', type: 'boolean' },
    { key: 'autoRescanInterval', value: '60', type: 'number' },
  ]);
}

/**
 * Seeds default themes for testing
 */
export async function seedDefaultThemes(db: DB) {
  await db.insert(themes).values([
    {
      name: 'Default',
      isDefault: true,
      isActive: true,
      primaryColor: '#00c2e5',
      secondaryColor: '#ec4899',
      tertiaryColor: '#8b5cf6',
      slateColor: '#64748b',
      successColor: '#10b981',
      dangerColor: '#ef4444',
      borderRadius: 'md',
    },
  ]);
}

/**
 * Seeds default alias themes for testing
 */
export async function seedDefaultAliasThemes(db: DB) {
  await db.insert(aliasThemes).values([
    {
      name: 'Default',
      isActive: true,
      gitColor: '32',
      dockerColor: '34',
      systemColor: '33',
      customColor: '36',
    },
  ]);
}

/**
 * Seeds all default data for testing
 */
export async function seedAllDefaults(db: DB) {
  await seedDefaultSettings(db);
  await seedDefaultThemes(db);
  await seedDefaultAliasThemes(db);
}
