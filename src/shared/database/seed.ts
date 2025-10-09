import { seedUsers } from './seeds/users';
import { seedSettings } from './seeds/settings';

export async function seedDatabase() {
  console.log('🌱 Seeding database...');

  await seedUsers();
  await seedSettings();

  console.log('✅ Database seeding complete');
}
