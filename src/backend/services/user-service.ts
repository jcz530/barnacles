import { eq } from 'drizzle-orm';
import { db, users } from '../../shared/database';
import type { User } from '../../shared/types/api';
import type { UserService } from '../types/api';

class UserServiceImpl implements UserService {
  async getUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async getUserById(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async createUser(userData: Omit<User, 'id'>): Promise<User> {
    const result = await db.insert(users).values(userData).returning();
    return result[0];
  }
}

export const userService = new UserServiceImpl();
