import { eq } from 'drizzle-orm';
import { db } from '../connection';
import { settings } from '../schema';

export async function seedSettings() {
  console.log('  ⚙️  Seeding settings...');

  const defaultSettings = [
    {
      key: 'autoOpenProcessUrls',
      value: 'true',
      type: 'boolean',
    },
  ];

  for (const setting of defaultSettings) {
    // Check if setting already exists
    const existing = await db.select().from(settings).where(eq(settings.key, setting.key)).limit(1);

    if (existing.length === 0) {
      await db.insert(settings).values({
        key: setting.key,
        value: setting.value,
        type: setting.type as 'string' | 'number' | 'boolean' | 'json',
      });
      console.log(`  ✓ Created setting: ${setting.key}`);
    } else {
      console.log(`  ℹ️  Setting ${setting.key} already exists, skipping`);
    }
  }

  console.log('  ✅ Settings seeded');
}
