import { db, projectAccounts } from '../../shared/database';
import { eq, and } from 'drizzle-orm';
import { encrypt, decrypt } from '../utils/encryption';
import { getEncryptionKey } from '../utils/key-manager';

export interface CreateAccountInput {
  projectId: string;
  name?: string;
  username?: string;
  email?: string;
  password?: string;
  notes?: string;
  loginUrl?: string;
}

export interface UpdateAccountInput {
  name?: string;
  username?: string;
  email?: string;
  password?: string;
  notes?: string;
  loginUrl?: string;
}

export interface Account {
  id: number;
  projectId: string;
  name: string | null;
  username: string | null;
  email: string | null;
  password: string | null; // Decrypted password
  notes: string | null;
  loginUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate that at least one field is provided
 */
function validateAccountInput(input: CreateAccountInput | UpdateAccountInput): void {
  const { name, username, email, password, notes, loginUrl } = input;
  const hasAtLeastOneField = name || username || email || password || notes || loginUrl;

  if (!hasAtLeastOneField) {
    throw new Error('At least one field must be provided');
  }
}

/**
 * Get all accounts for a project with decrypted passwords
 */
export async function getAccountsByProject(projectId: string): Promise<Account[]> {
  const accounts = await db
    .select()
    .from(projectAccounts)
    .where(eq(projectAccounts.projectId, projectId));

  const encryptionKey = await getEncryptionKey();

  // Decrypt passwords
  return accounts.map(account => ({
    ...account,
    password: account.password ? decrypt(account.password, encryptionKey) : null,
  }));
}

/**
 * Get a single account by ID with decrypted password
 */
export async function getAccountById(id: number): Promise<Account | null> {
  const account = await db
    .select()
    .from(projectAccounts)
    .where(eq(projectAccounts.id, id))
    .limit(1)
    .then(rows => rows[0]);

  if (!account) {
    return null;
  }

  const encryptionKey = await getEncryptionKey();

  return {
    ...account,
    password: account.password ? decrypt(account.password, encryptionKey) : null,
  };
}

/**
 * Create a new account with encrypted password
 */
export async function createAccount(input: CreateAccountInput): Promise<Account> {
  validateAccountInput(input);

  const encryptionKey = await getEncryptionKey();
  const now = new Date();

  const encryptedPassword = input.password ? encrypt(input.password, encryptionKey) : null;

  const [newAccount] = await db
    .insert(projectAccounts)
    .values({
      projectId: input.projectId,
      name: input.name ?? null,
      username: input.username ?? null,
      email: input.email ?? null,
      password: encryptedPassword,
      notes: input.notes ?? null,
      loginUrl: input.loginUrl ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return {
    ...newAccount,
    password: input.password ?? null, // Return the original plaintext password
  };
}

/**
 * Update an account
 */
export async function updateAccount(id: number, input: UpdateAccountInput): Promise<Account> {
  validateAccountInput(input);

  const encryptionKey = await getEncryptionKey();
  const now = new Date();

  // Only encrypt password if it's being updated
  const encryptedPassword =
    input.password !== undefined
      ? input.password
        ? encrypt(input.password, encryptionKey)
        : null
      : undefined;

  const updateData: Record<string, unknown> = {
    updatedAt: now,
  };

  if (input.name !== undefined) updateData.name = input.name || null;
  if (input.username !== undefined) updateData.username = input.username || null;
  if (input.email !== undefined) updateData.email = input.email || null;
  if (encryptedPassword !== undefined) updateData.password = encryptedPassword;
  if (input.notes !== undefined) updateData.notes = input.notes || null;
  if (input.loginUrl !== undefined) updateData.loginUrl = input.loginUrl || null;

  const [updatedAccount] = await db
    .update(projectAccounts)
    .set(updateData)
    .where(eq(projectAccounts.id, id))
    .returning();

  if (!updatedAccount) {
    throw new Error('Account not found');
  }

  return {
    ...updatedAccount,
    password: updatedAccount.password ? decrypt(updatedAccount.password, encryptionKey) : null,
  };
}

/**
 * Delete an account
 */
export async function deleteAccount(id: number): Promise<void> {
  await db.delete(projectAccounts).where(eq(projectAccounts.id, id));
}

/**
 * Delete all accounts for a project
 */
export async function deleteAccountsByProject(projectId: string): Promise<void> {
  await db.delete(projectAccounts).where(eq(projectAccounts.projectId, projectId));
}
