import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createIntegrationTestContext, mockDatabaseForIntegration } from '@test/contexts';
import { del, get, post, put } from '@test/helpers/api-client';
import { setupProjectRoutes } from '@test/helpers/route-test-setup';
import { createProjectData } from '@test/factories/project.factory';
import { projects as projectsSchema } from '@shared/database/schema';

// Mock the key manager to avoid safeStorage issues in tests
vi.mock('@backend/utils/key-manager', () => {
  const testKey = Buffer.from('0'.repeat(64), 'hex'); // 32 bytes
  return {
    getEncryptionKey: vi.fn().mockResolvedValue(testKey),
  };
});

// Mock the database connection module
mockDatabaseForIntegration();

describe('Projects Accounts API Integration Tests', () => {
  const context = createIntegrationTestContext();

  beforeEach(async () => {
    await setupProjectRoutes(context);
  });

  afterEach(async () => {
    await context.teardown();
  });

  describe('GET /api/projects/:projectId/accounts', () => {
    it('should return empty array when no accounts exist', async () => {
      const { db, app } = context.get();

      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      const response = await get(app, `/api/projects/${project.id}/accounts`);

      expect(response.status).toBe(200);
      expect((response.data as any).data).toEqual([]);
    });

    it('should return all accounts for a project', async () => {
      const { db, app } = context.get();

      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      // Create two accounts
      await post(app, `/api/projects/${project.id}/accounts`, {
        name: 'Account 1',
        username: 'user1',
        password: 'pass1',
      });
      await post(app, `/api/projects/${project.id}/accounts`, {
        name: 'Account 2',
        email: 'user2@example.com',
      });

      const response = await get(app, `/api/projects/${project.id}/accounts`);

      expect(response.status).toBe(200);
      const accounts = (response.data as any).data;
      expect(accounts).toHaveLength(2);
      expect(accounts[0].name).toBe('Account 1');
      expect(accounts[1].name).toBe('Account 2');
    });
  });

  describe('GET /api/projects/:projectId/accounts/:id', () => {
    it('should return a specific account with decrypted password', async () => {
      const { db, app } = context.get();

      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      // Create an account
      const createResponse = await post(app, `/api/projects/${project.id}/accounts`, {
        username: 'testuser',
        password: 'secret123',
      });

      const accountId = (createResponse.data as any).data.id;

      const response = await get(app, `/api/projects/${project.id}/accounts/${accountId}`);

      expect(response.status).toBe(200);
      const account = (response.data as any).data;
      expect(account.username).toBe('testuser');
      expect(account.password).toBe('secret123'); // Should be decrypted
    });

    it('should return 404 for non-existent account', async () => {
      const { db, app } = context.get();

      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      const response = await get(app, `/api/projects/${project.id}/accounts/99999`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/projects/:projectId/accounts', () => {
    it('should create a new account with all fields', async () => {
      const { db, app } = context.get();

      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      const response = await post(app, `/api/projects/${project.id}/accounts`, {
        name: 'Admin Account',
        username: 'admin',
        email: 'admin@example.com',
        password: 'secret123',
        notes: 'Main admin account',
        loginUrl: 'https://example.com/login',
      });

      expect(response.status).toBe(200);
      const account = (response.data as any).data;
      expect(account.name).toBe('Admin Account');
      expect(account.username).toBe('admin');
      expect(account.email).toBe('admin@example.com');
      expect(account.password).toBe('secret123');
      expect(account.notes).toBe('Main admin account');
      expect(account.loginUrl).toBe('https://example.com/login');
    });

    it('should create an account with only one field', async () => {
      const { db, app } = context.get();

      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      const response = await post(app, `/api/projects/${project.id}/accounts`, {
        username: 'testuser',
      });

      expect(response.status).toBe(200);
      expect((response.data as any).data.username).toBe('testuser');
    });

    it('should return 500 when no fields are provided', async () => {
      const { db, app } = context.get();

      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      const response = await post(app, `/api/projects/${project.id}/accounts`, {});

      expect(response.status).toBe(500);
      expect((response.data as any).error).toBe('At least one field must be provided');
    });
  });

  describe('PUT /api/projects/:projectId/accounts/:id', () => {
    it('should update an account', async () => {
      const { db, app } = context.get();

      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      // Create an account
      const createResponse = await post(app, `/api/projects/${project.id}/accounts`, {
        username: 'olduser',
        password: 'oldpass',
      });

      const accountId = (createResponse.data as any).data.id;

      // Update the account
      const response = await put(app, `/api/projects/${project.id}/accounts/${accountId}`, {
        username: 'newuser',
        password: 'newpass',
        email: 'new@example.com',
      });

      expect(response.status).toBe(200);
      const account = (response.data as any).data;
      expect(account.username).toBe('newuser');
      expect(account.password).toBe('newpass');
      expect(account.email).toBe('new@example.com');
    });

    it('should return 500 when no fields are provided for update', async () => {
      const { db, app } = context.get();

      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      // Create an account
      const createResponse = await post(app, `/api/projects/${project.id}/accounts`, {
        username: 'testuser',
      });

      const accountId = (createResponse.data as any).data.id;

      const response = await put(app, `/api/projects/${project.id}/accounts/${accountId}`, {});

      expect(response.status).toBe(500);
    });
  });

  describe('DELETE /api/projects/:projectId/accounts/:id', () => {
    it('should delete an account', async () => {
      const { db, app } = context.get();

      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      // Create an account
      const createResponse = await post(app, `/api/projects/${project.id}/accounts`, {
        username: 'testuser',
      });

      const accountId = (createResponse.data as any).data.id;

      // Delete the account
      const response = await del(app, `/api/projects/${project.id}/accounts/${accountId}`);

      expect(response.status).toBe(200);
      expect((response.data as any).message).toBe('Account deleted successfully');

      // Verify it's deleted
      const getResponse = await get(app, `/api/projects/${project.id}/accounts/${accountId}`);
      expect(getResponse.status).toBe(404);
    });

    it('should not throw error when deleting non-existent account', async () => {
      const { db, app } = context.get();

      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      const response = await del(app, `/api/projects/${project.id}/accounts/99999`);

      expect(response.status).toBe(200);
    });
  });
});
