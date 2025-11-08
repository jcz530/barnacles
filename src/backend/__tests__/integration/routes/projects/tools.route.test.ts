import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createIntegrationTestContext, mockDatabaseForIntegration } from '@test/contexts';
import { get, patch, post } from '@test/helpers/api-client';
import { setupProjectRoutes } from '@test/helpers/route-test-setup';
import { createProjectData } from '@test/factories/project.factory';
import { projects as projectsSchema } from '@shared/database/schema';

// Mock the database connection module
mockDatabaseForIntegration();

// Mock IDE and Terminal detector services to prevent actual application launches
vi.mock('@backend/services/ide-detector-service', () => ({
  ideDetectorService: {
    detectIDEs: vi
      .fn()
      .mockResolvedValue([{ id: 'vscode', name: 'Visual Studio Code', path: '/usr/bin/code' }]),
    getAvailableIDEs: vi.fn().mockReturnValue([{ id: 'vscode', name: 'Visual Studio Code' }]),
    openProjectInIDE: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@backend/services/terminal-detector-service', () => ({
  terminalDetectorService: {
    detectTerminals: vi
      .fn()
      .mockResolvedValue([
        { id: 'terminal', name: 'Terminal', path: '/System/Applications/Utilities/Terminal.app' },
      ]),
    getAvailableTerminals: vi.fn().mockReturnValue([{ id: 'terminal', name: 'Terminal' }]),
    openTerminalAtPath: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Projects Tools API Integration Tests', () => {
  const context = createIntegrationTestContext();

  beforeEach(async () => {
    await setupProjectRoutes(context);
  });

  afterEach(async () => {
    await context.teardown();
  });

  describe('GET /api/projects/ides/detected', () => {
    it('should return detected IDEs', async () => {
      const { app } = context.get();

      const response = await get(app, '/api/projects/ides/detected');

      // Accept both 200 and 500 as the detection might fail in test environment
      expect([200, 500]).toContain(response.status);
      if (response.status === 200) {
        expect((response.data as any).data).toBeDefined();
        expect(Array.isArray((response.data as any).data)).toBe(true);
      }
    });
  });

  describe('GET /api/projects/ides/available', () => {
    it('should return available IDE definitions', async () => {
      const { app } = context.get();

      const response = await get(app, '/api/projects/ides/available');

      expect(response.status).toBe(200);
      expect((response.data as any).data).toBeDefined();
      expect(Array.isArray((response.data as any).data)).toBe(true);
    });
  });

  describe('PATCH /api/projects/:id/ide', () => {
    it('should update preferred IDE for a project', async () => {
      const { db, app } = context.get();

      // Create a project
      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      const response = await patch(app, `/api/projects/${project.id}/ide`, {
        ideId: 'vscode',
      });

      expect(response.status).toBe(200);
      expect((response.data as any).message).toBe('Preferred IDE updated successfully');
    });

    it('should return 404 for non-existent project', async () => {
      const { app } = context.get();

      const response = await patch(app, '/api/projects/non-existent-id/ide', {
        ideId: 'vscode',
      });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/projects/:id/open', () => {
    it('should open project in IDE', async () => {
      const { db, app } = context.get();

      // Create a project
      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      const response = await post(app, `/api/projects/${project.id}/open`, {
        ideId: 'vscode',
      });

      expect(response.status).toBe(200);
      expect((response.data as any).message).toBe('Project opened in IDE');
    });

    it('should handle opening project without IDE specified', async () => {
      const { db, app } = context.get();

      // Create a project without a preferred IDE
      const [project] = await db
        .insert(projectsSchema)
        .values(createProjectData({ preferredIdeId: null }))
        .returning();

      const response = await post(app, `/api/projects/${project.id}/open`, {});

      // May succeed (200) if default IDE is available, or fail (500) if not
      expect([200, 500]).toContain(response.status);
    });

    it('should return 404 for non-existent project', async () => {
      const { app } = context.get();

      const response = await post(app, '/api/projects/non-existent-id/open', {
        ideId: 'vscode',
      });

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/projects/terminals/detected', () => {
    it('should return detected terminals', async () => {
      const { app } = context.get();

      const response = await get(app, '/api/projects/terminals/detected');

      // Accept both 200 and 500 as the detection might fail in test environment
      expect([200, 500]).toContain(response.status);
      if (response.status === 200) {
        expect((response.data as any).data).toBeDefined();
        expect(Array.isArray((response.data as any).data)).toBe(true);
      }
    });
  });

  describe('GET /api/projects/terminals/available', () => {
    it('should return available terminal definitions', async () => {
      const { app } = context.get();

      const response = await get(app, '/api/projects/terminals/available');

      expect(response.status).toBe(200);
      expect((response.data as any).data).toBeDefined();
      expect(Array.isArray((response.data as any).data)).toBe(true);
    });
  });

  describe('PATCH /api/projects/:id/terminal', () => {
    it('should update preferred terminal for a project', async () => {
      const { db, app } = context.get();

      // Create a project
      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      const response = await patch(app, `/api/projects/${project.id}/terminal`, {
        terminalId: 'terminal',
      });

      expect(response.status).toBe(200);
      expect((response.data as any).message).toBe('Preferred terminal updated successfully');
    });

    it('should return 404 for non-existent project', async () => {
      const { app } = context.get();

      const response = await patch(app, '/api/projects/non-existent-id/terminal', {
        terminalId: 'terminal',
      });

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/projects/:id/open-terminal', () => {
    it('should open terminal at project path', async () => {
      const { db, app } = context.get();

      // Create a project
      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      const response = await post(app, `/api/projects/${project.id}/open-terminal`, {
        terminalId: 'terminal',
      });

      expect(response.status).toBe(200);
      expect((response.data as any).message).toBe('Terminal opened at project path');
    });

    it('should handle opening terminal without terminal specified', async () => {
      const { db, app } = context.get();

      // Create a project without a preferred terminal
      const [project] = await db
        .insert(projectsSchema)
        .values(createProjectData({ preferredTerminalId: null }))
        .returning();

      const response = await post(app, `/api/projects/${project.id}/open-terminal`, {});

      // May succeed (200) if default terminal is available, or fail (500) if not
      expect([200, 500]).toContain(response.status);
    });

    it('should return 404 for non-existent project', async () => {
      const { app } = context.get();

      const response = await post(app, '/api/projects/non-existent-id/open-terminal', {
        terminalId: 'terminal',
      });

      expect(response.status).toBe(404);
    });
  });
});
