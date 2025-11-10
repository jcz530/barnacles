import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createUnitTestContext, mockDatabaseForUnit } from '@test/contexts';
import { projectProcessService } from '@backend/services/project/project-process-service';
import { db } from '@shared/database';
import { projectProcessCommands, projectProcesses, projects } from '@shared/database/schema';
import { eq } from 'drizzle-orm';
import type { StartProcess } from '@shared/types/process';

// Mock the database connection module
mockDatabaseForUnit();

describe('ProjectProcessService', () => {
  const context = createUnitTestContext();

  beforeEach(async () => {
    await context.setup();
  });

  afterEach(async () => {
    await context.teardown();
  });

  describe('getStartProcesses', () => {
    it('should return empty array for project with no processes', async () => {
      const result = await projectProcessService.getStartProcesses('nonexistent-project');
      expect(result).toHaveLength(0);
    });

    it('should return processes with commands in correct order', async () => {
      const projectId = 'test-project-123';

      // Create project first (required for foreign key)
      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      // Create two processes
      const process1 = await db
        .insert(projectProcesses)
        .values({
          id: 'process-1',
          projectId,
          name: 'API Server',
          workingDir: '/api',
          color: '#FF5733',
          url: 'http://localhost:3000',
          order: 0,
        })
        .returning();

      const process2 = await db
        .insert(projectProcesses)
        .values({
          id: 'process-2',
          projectId,
          name: 'Frontend',
          workingDir: '/frontend',
          color: '#33FF57',
          order: 1,
        })
        .returning();

      // Add commands to process 1
      await db.insert(projectProcessCommands).values([
        { id: 'cmd-1-1', processId: 'process-1', command: 'npm install', order: 0 },
        { id: 'cmd-1-2', processId: 'process-1', command: 'npm run dev', order: 1 },
      ]);

      // Add commands to process 2
      await db
        .insert(projectProcessCommands)
        .values([{ id: 'cmd-2-1', processId: 'process-2', command: 'yarn dev', order: 0 }]);

      const result = await projectProcessService.getStartProcesses(projectId);

      expect(result).toHaveLength(2);

      // Check first process
      expect(result[0].id).toBe('process-1');
      expect(result[0].name).toBe('API Server');
      expect(result[0].commands).toEqual(['npm install', 'npm run dev']);
      expect(result[0].workingDir).toBe('/api');
      expect(result[0].color).toBe('#FF5733');
      expect(result[0].url).toBe('http://localhost:3000');

      // Check second process
      expect(result[1].id).toBe('process-2');
      expect(result[1].name).toBe('Frontend');
      expect(result[1].commands).toEqual(['yarn dev']);
      expect(result[1].workingDir).toBe('/frontend');
      expect(result[1].color).toBe('#33FF57');
      expect(result[1].url).toBeUndefined();
    });

    it('should respect process order', async () => {
      const projectId = 'test-order-project';

      // Create project first
      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      // Create processes in non-sequential order
      await db.insert(projectProcesses).values([
        { id: 'process-c', projectId, name: 'Third', order: 2 },
        { id: 'process-a', projectId, name: 'First', order: 0 },
        { id: 'process-b', projectId, name: 'Second', order: 1 },
      ]);

      const result = await projectProcessService.getStartProcesses(projectId);

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('First');
      expect(result[1].name).toBe('Second');
      expect(result[2].name).toBe('Third');
    });

    it('should handle processes with null optional fields', async () => {
      const projectId = 'test-minimal-project';

      // Create project first
      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      await db.insert(projectProcesses).values({
        id: 'minimal-process',
        projectId,
        name: 'Minimal Process',
        workingDir: null,
        color: null,
        url: null,
        order: 0,
      });

      await db.insert(projectProcessCommands).values({
        id: 'cmd-1',
        processId: 'minimal-process',
        command: 'echo "hello"',
        order: 0,
      });

      const result = await projectProcessService.getStartProcesses(projectId);

      expect(result).toHaveLength(1);
      expect(result[0].workingDir).toBeUndefined();
      expect(result[0].color).toBeUndefined();
      expect(result[0].url).toBeUndefined();
    });
  });

  describe('updateStartProcesses', () => {
    it('should create new processes for a project', async () => {
      const projectId = 'new-project-123';

      // Create a project first
      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      const processes: StartProcess[] = [
        {
          id: 'proc-1',
          name: 'Backend',
          commands: ['npm install', 'npm run dev'],
          workingDir: '/backend',
          color: '#FF0000',
          url: 'http://localhost:3001',
        },
        {
          id: 'proc-2',
          name: 'Frontend',
          commands: ['yarn dev'],
          workingDir: '/frontend',
          color: '#00FF00',
        },
      ];

      await projectProcessService.updateStartProcesses(projectId, processes);

      const result = await projectProcessService.getStartProcesses(projectId);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Backend');
      expect(result[0].commands).toEqual(['npm install', 'npm run dev']);
      expect(result[1].name).toBe('Frontend');
      expect(result[1].commands).toEqual(['yarn dev']);
    });

    it('should replace existing processes', async () => {
      const projectId = 'existing-project-456';

      // Create a project
      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      // Create initial processes
      await db.insert(projectProcesses).values({
        id: 'old-process',
        projectId,
        name: 'Old Process',
        order: 0,
      });

      await db.insert(projectProcessCommands).values({
        id: 'old-cmd',
        processId: 'old-process',
        command: 'old command',
        order: 0,
      });

      // Update with new processes
      const newProcesses: StartProcess[] = [
        {
          id: 'new-process',
          name: 'New Process',
          commands: ['new command'],
        },
      ];

      await projectProcessService.updateStartProcesses(projectId, newProcesses);

      const result = await projectProcessService.getStartProcesses(projectId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('new-process');
      expect(result[0].name).toBe('New Process');
      expect(result[0].commands).toEqual(['new command']);

      // Verify old process is gone
      const oldProcesses = await db
        .select()
        .from(projectProcesses)
        .where(eq(projectProcesses.id, 'old-process'));

      expect(oldProcesses).toHaveLength(0);
    });

    it('should clear all processes when empty array is provided', async () => {
      const projectId = 'clear-project-789';

      // Create a project
      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      // Create initial process
      await db.insert(projectProcesses).values({
        id: 'process-to-clear',
        projectId,
        name: 'Will Be Removed',
        order: 0,
      });

      // Clear all processes
      await projectProcessService.updateStartProcesses(projectId, []);

      const result = await projectProcessService.getStartProcesses(projectId);
      expect(result).toHaveLength(0);
    });

    it('should preserve command order', async () => {
      const projectId = 'command-order-project';

      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      const processes: StartProcess[] = [
        {
          id: 'ordered-process',
          name: 'Multi-step Process',
          commands: ['step 1', 'step 2', 'step 3', 'step 4'],
        },
      ];

      await projectProcessService.updateStartProcesses(projectId, processes);

      const result = await projectProcessService.getStartProcesses(projectId);

      expect(result[0].commands).toEqual(['step 1', 'step 2', 'step 3', 'step 4']);
    });

    it('should update project updatedAt timestamp', async () => {
      const projectId = 'timestamp-project';

      const initialTime = new Date('2024-01-01T00:00:00Z');

      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
        updatedAt: initialTime,
      });

      // Wait a tiny bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      const processes: StartProcess[] = [
        {
          id: 'proc-1',
          name: 'Process',
          commands: ['echo "test"'],
        },
      ];

      await projectProcessService.updateStartProcesses(projectId, processes);

      const updatedProject = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      expect(updatedProject[0].updatedAt.getTime()).toBeGreaterThan(initialTime.getTime());
    });

    it('should handle processes with optional fields undefined', async () => {
      const projectId = 'optional-fields-project';

      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      const processes: StartProcess[] = [
        {
          id: 'minimal-proc',
          name: 'Minimal',
          commands: ['run'],
          // workingDir, color, url are undefined
        },
      ];

      await projectProcessService.updateStartProcesses(projectId, processes);

      const result = await projectProcessService.getStartProcesses(projectId);

      expect(result[0].workingDir).toBeUndefined();
      expect(result[0].color).toBeUndefined();
      expect(result[0].url).toBeUndefined();
    });
  });
});
