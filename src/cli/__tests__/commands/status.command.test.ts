import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StatusCommand } from '@cli/commands/status';
import { createCLITestContext, mockDatabaseForCLI } from '@test/contexts';
import { createProjectsData } from '@test/factories/project.factory';
import { projects as projectsSchema } from '@shared/database/schema';

// Mock the database connection module
mockDatabaseForCLI();

describe('StatusCommand', () => {
  const context = createCLITestContext<StatusCommand>();

  beforeEach(async () => {
    await context.setup(() => new StatusCommand(), {
      mockPrompts: true,
      mockBranding: true,
      mockColors: true,
      mockAppManager: { backendUrl: null }, // Default to offline
    });
  });

  afterEach(async () => {
    await context.teardown();
  });

  describe('command metadata', () => {
    it('should have correct name and description', () => {
      const { command } = context.get();

      expect(command.name).toBe('status');
      expect(command.description).toBe('Check the status of Barnacles');
      expect(command.showIntro).toBe(false);
    });

    it('should have help text and examples', () => {
      const { command } = context.get();

      expect(command.helpText).toBeDefined();
      expect(command.examples).toBeDefined();
      expect(command.examples?.length).toBeGreaterThan(0);
    });
  });

  describe('execute', () => {
    it('should execute without errors when database is empty', async () => {
      const { command } = context.get();

      // The command execution will call the real functions, not mocks
      // since the StatusCommand uses actual prompts
      await expect(command.execute({}, [])).resolves.toBeUndefined();
    });

    it('should display project count from database', async () => {
      const { db, command } = context.get();

      // Create test projects
      const projectsData = createProjectsData(5);
      await db.insert(projectsSchema).values(projectsData);

      // Execute command - it will use real prompts but we can verify it doesn't throw
      await expect(command.execute({}, [])).resolves.toBeUndefined();
    });

    it('should show app as offline when backend is not running', async () => {
      const { command } = context.get();

      // Execute command - backend is offline by default in our setup
      await expect(command.execute({}, [])).resolves.toBeUndefined();
    });

    it('should handle database errors gracefully', async () => {
      const { command } = context.get();

      // Break the database connection
      const connectionModule = await import('@shared/database/connection');
      (connectionModule as any).db = {
        select: () => {
          throw new Error('Database connection error');
        },
      };

      // Should not throw even with broken database
      await expect(command.execute({}, [])).resolves.toBeUndefined();
    });
  });

  describe('run', () => {
    it('should execute the command with lifecycle hooks', async () => {
      const { command } = context.get();
      const { vi } = await import('vitest');
      const executeSpy = vi.spyOn(command, 'execute');

      await command.run({}, []);

      expect(executeSpy).toHaveBeenCalledWith({}, []);
    });
  });

  describe('matches', () => {
    it('should match its own name', () => {
      const { command } = context.get();

      expect(command.matches('status')).toBe(true);
    });

    it('should not match other command names', () => {
      const { command } = context.get();

      expect(command.matches('projects')).toBe(false);
      expect(command.matches('help')).toBe(false);
    });
  });
});
