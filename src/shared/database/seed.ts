import { seedSettings } from './seeds/settings';

export async function seedDatabase() {
  console.log('🌱 Seeding database...');

  await seedSettings();

  console.log('✅ Database seeding complete');
}
