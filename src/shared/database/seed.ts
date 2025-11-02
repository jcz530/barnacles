import { seedSettings } from './seeds/settings';
import { seedThemes } from './seeds/themes';

export async function seedDatabase() {
  console.log('🌱 Seeding database...');

  await seedSettings();
  await seedThemes();

  console.log('✅ Database seeding complete');
}
