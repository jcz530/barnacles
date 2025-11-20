import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createUnitTestContext, mockDatabaseForUnit } from '@test/contexts';
import * as accountService from '@backend/services/account-service';
import { db, projectAccounts } from '@shared/database';
import { eq } from 'drizzle-orm';

// Mock the key manager to avoid safeStorage issues in tests
// Use a consistent key for all encrypt/decrypt operations
vi.mock('@backend/utils/key-manager', () => {
  // Create a consistent 32-byte key as a hex string
  const testKey = Buffer.from('0'.repeat(64), 'hex'); // 32 bytes
  return {
    getEncryptionKey: vi.fn().mockResolvedValue(testKey),
  };
});

// Mock the database connection module
mockDatabaseForUnit();

describe('AccountService', () => {
  const context = createUnitTestContext();

  beforeEach(async () => {
    await context.setup();
  });

  afterEach(async () => {
    await context.teardown();
  });

  const createTestProject = async () => {
    const { db } = context.get();
    const uniqueId = Date.now() + Math.random();
    const [project] = await db
      .insert((await import('@shared/database/schema')).projects)
      .values({
        name: `Test Project ${uniqueId}`,
        path: `/test/path/${uniqueId}`,
      })
      .returning();
    return project;
  };

  describe('createAccount', () => {
    it('should create an account with all fields', async () => {
      const project = await createTestProject();

      const input: accountService.CreateAccountInput = {
        projectId: project.id,
        name: 'Admin Account',
        username: 'admin',
        email: 'admin@example.com',
        password: 'secret123',
        notes: 'Main admin account',
        loginUrl: 'https://example.com/login',
      };

      const account = await accountService.createAccount(input);

      expect(account).toBeDefined();
      expect(account.id).toBeDefined();
      expect(account.projectId).toBe(project.id);
      expect(account.name).toBe('Admin Account');
      expect(account.username).toBe('admin');
      expect(account.email).toBe('admin@example.com');
      expect(account.password).toBe('secret123'); // Returned as plaintext
      expect(account.notes).toBe('Main admin account');
      expect(account.loginUrl).toBe('https://example.com/login');
    });

    it('should create an account with only required fields', async () => {
      const project = await createTestProject();

      const input: accountService.CreateAccountInput = {
        projectId: project.id,
        username: 'testuser',
      };

      const account = await accountService.createAccount(input);

      expect(account).toBeDefined();
      expect(account.username).toBe('testuser');
      expect(account.name).toBeNull();
      expect(account.email).toBeNull();
      expect(account.password).toBeNull();
      expect(account.notes).toBeNull();
      expect(account.loginUrl).toBeNull();
    });

    it('should throw error when no fields are provided', async () => {
      const project = await createTestProject();

      const input: accountService.CreateAccountInput = {
        projectId: project.id,
      };

      await expect(accountService.createAccount(input)).rejects.toThrow(
        'At least one field must be provided'
      );
    });

    it('should encrypt password in database', async () => {
      const project = await createTestProject();

      const input: accountService.CreateAccountInput = {
        projectId: project.id,
        password: 'secret123',
      };

      const account = await accountService.createAccount(input);

      // Check the database directly
      const [dbAccount] = await db
        .select()
        .from(projectAccounts)
        .where(eq(projectAccounts.id, account.id));

      // Password in database should be encrypted (not plaintext)
      expect(dbAccount.password).not.toBe('secret123');
      expect(dbAccount.password).toContain(':'); // Encrypted format has colons
    });
  });

  describe('getAccountsByProject', () => {
    it('should return empty array when no accounts exist', async () => {
      const project = await createTestProject();

      const accounts = await accountService.getAccountsByProject(project.id);

      expect(accounts).toEqual([]);
    });

    it('should return all accounts for a project with decrypted passwords', async () => {
      const project = await createTestProject();

      // Create two accounts
      await accountService.createAccount({
        projectId: project.id,
        name: 'Account 1',
        password: 'pass1',
      });
      await accountService.createAccount({
        projectId: project.id,
        name: 'Account 2',
        password: 'pass2',
      });

      const accounts = await accountService.getAccountsByProject(project.id);

      expect(accounts).toHaveLength(2);
      expect(accounts[0].password).toBe('pass1');
      expect(accounts[1].password).toBe('pass2');
    });

    it('should not return accounts from other projects', async () => {
      const project1 = await createTestProject();
      const project2 = await createTestProject();

      await accountService.createAccount({
        projectId: project1.id,
        username: 'user1',
      });
      await accountService.createAccount({
        projectId: project2.id,
        username: 'user2',
      });

      const accounts = await accountService.getAccountsByProject(project1.id);

      expect(accounts).toHaveLength(1);
      expect(accounts[0].username).toBe('user1');
    });
  });

  describe('getAccountById', () => {
    it('should return account with decrypted password', async () => {
      const project = await createTestProject();

      const created = await accountService.createAccount({
        projectId: project.id,
        username: 'testuser',
        password: 'secret123',
      });

      const account = await accountService.getAccountById(created.id);

      expect(account).toBeDefined();
      expect(account?.id).toBe(created.id);
      expect(account?.username).toBe('testuser');
      expect(account?.password).toBe('secret123');
    });

    it('should return null for non-existent account', async () => {
      const account = await accountService.getAccountById(99999);

      expect(account).toBeNull();
    });
  });

  describe('updateAccount', () => {
    it('should update all fields', async () => {
      const project = await createTestProject();

      const created = await accountService.createAccount({
        projectId: project.id,
        username: 'olduser',
        password: 'oldpass',
      });

      const updated = await accountService.updateAccount(created.id, {
        name: 'Updated Name',
        username: 'newuser',
        email: 'new@example.com',
        password: 'newpass',
        notes: 'Updated notes',
        loginUrl: 'https://new.example.com',
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.username).toBe('newuser');
      expect(updated.email).toBe('new@example.com');
      expect(updated.password).toBe('newpass');
      expect(updated.notes).toBe('Updated notes');
      expect(updated.loginUrl).toBe('https://new.example.com');
    });

    it('should update only provided fields', async () => {
      const project = await createTestProject();

      const created = await accountService.createAccount({
        projectId: project.id,
        username: 'testuser',
        password: 'oldpass',
        email: 'old@example.com',
      });

      const updated = await accountService.updateAccount(created.id, {
        password: 'newpass',
      });

      expect(updated.username).toBe('testuser'); // Unchanged
      expect(updated.email).toBe('old@example.com'); // Unchanged
      expect(updated.password).toBe('newpass'); // Changed
    });

    it('should throw error when no fields are provided', async () => {
      const project = await createTestProject();

      const created = await accountService.createAccount({
        projectId: project.id,
        username: 'testuser',
      });

      await expect(accountService.updateAccount(created.id, {})).rejects.toThrow(
        'At least one field must be provided'
      );
    });

    it('should encrypt updated password in database', async () => {
      const project = await createTestProject();

      const created = await accountService.createAccount({
        projectId: project.id,
        username: 'testuser',
        password: 'oldpass',
      });

      await accountService.updateAccount(created.id, {
        password: 'newpass',
      });

      // Check the database directly
      const [dbAccount] = await db
        .select()
        .from(projectAccounts)
        .where(eq(projectAccounts.id, created.id));

      // Password in database should be encrypted (not plaintext)
      expect(dbAccount.password).not.toBe('newpass');
      expect(dbAccount.password).toContain(':'); // Encrypted format has colons
    });
  });

  describe('deleteAccount', () => {
    it('should delete an account', async () => {
      const project = await createTestProject();

      const created = await accountService.createAccount({
        projectId: project.id,
        username: 'testuser',
      });

      await accountService.deleteAccount(created.id);

      const account = await accountService.getAccountById(created.id);
      expect(account).toBeNull();
    });

    it('should not throw error when deleting non-existent account', async () => {
      await expect(accountService.deleteAccount(99999)).resolves.not.toThrow();
    });
  });

  describe('deleteAccountsByProject', () => {
    it('should delete all accounts for a project', async () => {
      const project = await createTestProject();

      await accountService.createAccount({
        projectId: project.id,
        username: 'user1',
      });
      await accountService.createAccount({
        projectId: project.id,
        username: 'user2',
      });

      await accountService.deleteAccountsByProject(project.id);

      const accounts = await accountService.getAccountsByProject(project.id);
      expect(accounts).toHaveLength(0);
    });

    it('should not delete accounts from other projects', async () => {
      const project1 = await createTestProject();
      const project2 = await createTestProject();

      await accountService.createAccount({
        projectId: project1.id,
        username: 'user1',
      });
      await accountService.createAccount({
        projectId: project2.id,
        username: 'user2',
      });

      await accountService.deleteAccountsByProject(project1.id);

      const accounts1 = await accountService.getAccountsByProject(project1.id);
      const accounts2 = await accountService.getAccountsByProject(project2.id);

      expect(accounts1).toHaveLength(0);
      expect(accounts2).toHaveLength(1);
    });
  });
});
