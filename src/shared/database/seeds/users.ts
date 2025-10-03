import { eq } from 'drizzle-orm';
import { db } from '../connection';
import { users } from '../schema';

const SEED_USERS = [
  { name: 'John Doe', email: 'john@example.com' },
  { name: 'Jane Smith', email: 'jane@example.com' },
  { name: 'Bob Johnson', email: 'bob@example.com' },
];

export async function seedUsers() {
  console.log('  👥 Seeding users...');

  // Check if users already exist
  const existingUsers = await db.select().from(users);

  if (existingUsers.length > 0) {
    console.log(`  ℹ️  Users table already has ${existingUsers.length} user(s), skipping`);
    return;
  }

  // Insert seed users
  for (const userData of SEED_USERS) {
    // Check if user with this email already exists
    // prettier-ignore
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, userData.email))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(users).values(userData);
      console.log(`  ✓ Created user: ${userData.email}`);
    }
  }

  console.log('  ✅ Users seeded');
}
