import { seedUsers } from './seeds/users';

export async function seedDatabase() {
  console.log('🌱 Seeding database...');

  await seedUsers();

  console.log('✅ Database seeding complete');
}
