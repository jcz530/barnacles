import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createUnitTestContext, mockDatabaseForUnit } from '@test/contexts';
import { projectToolsService } from '@backend/services/project/project-tools-service';
import { db } from '@shared/database';
import { projects } from '@shared/database/schema';
import { eq } from 'drizzle-orm';
import { ideDetectorService } from '@backend/services/ide-detector-service';
import { terminalDetectorService } from '@backend/services/terminal-detector-service';

// Mock the database connection module
mockDatabaseForUnit();

// Mock the IDE and terminal detector services
vi.mock('@backend/services/ide-detector-service', () => ({
  ideDetectorService: {
    detectInstalledIDEs: vi.fn(),
    getAvailableIDEs: vi.fn(),
    openProjectInIDE: vi.fn(),
  },
}));

vi.mock('@backend/services/terminal-detector-service', () => ({
  terminalDetectorService: {
    detectInstalledTerminals: vi.fn(),
    getAvailableTerminals: vi.fn(),
    openTerminalAtPath: vi.fn(),
  },
}));

describe('ProjectToolsService', () => {
  const context = createUnitTestContext();

  beforeEach(async () => {
    await context.setup();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await context.teardown();
  });

  describe('IDE Management', () => {
    describe('getDetectedIDEs', () => {
      it('should return detected IDEs from detector service', async () => {
        const mockIDEs = [
          { id: 'vscode', name: 'VS Code', isInstalled: true },
          { id: 'cursor', name: 'Cursor', isInstalled: true },
        ];

        vi.mocked(ideDetectorService.detectInstalledIDEs).mockResolvedValue(mockIDEs);

        const result = await projectToolsService.getDetectedIDEs();

        expect(result).toEqual(mockIDEs);
        expect(ideDetectorService.detectInstalledIDEs).toHaveBeenCalledOnce();
      });
    });

    describe('getAvailableIDEs', () => {
      it('should return available IDEs from detector service', () => {
        const mockIDEs = [
          { id: 'vscode', name: 'VS Code', paths: ['/Applications/Visual Studio Code.app'] },
          { id: 'sublime', name: 'Sublime Text', paths: ['/Applications/Sublime Text.app'] },
        ];

        vi.mocked(ideDetectorService.getAvailableIDEs).mockReturnValue(mockIDEs);

        const result = projectToolsService.getAvailableIDEs();

        expect(result).toEqual(mockIDEs);
        expect(ideDetectorService.getAvailableIDEs).toHaveBeenCalledOnce();
      });
    });

    describe('updatePreferredIDE', () => {
      it('should update preferred IDE for a project', async () => {
        const projectId = 'test-project-123';

        await db.insert(projects).values({
          id: projectId,
          name: 'Test Project',
          path: '/test/path',
          preferredIde: null,
        });

        await projectToolsService.updatePreferredIDE(projectId, 'vscode');

        const updated = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

        expect(updated[0].preferredIde).toBe('vscode');
      });

      it('should clear preferred IDE when null is provided', async () => {
        const projectId = 'test-project-456';

        await db.insert(projects).values({
          id: projectId,
          name: 'Test Project',
          path: '/test/path',
          preferredIde: 'cursor',
        });

        await projectToolsService.updatePreferredIDE(projectId, null);

        const updated = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

        expect(updated[0].preferredIde).toBeNull();
      });

      it('should update updatedAt timestamp', async () => {
        const projectId = 'test-project-789';
        const initialTime = new Date('2024-01-01T00:00:00Z');

        await db.insert(projects).values({
          id: projectId,
          name: 'Test Project',
          path: '/test/path',
          updatedAt: initialTime,
        });

        await new Promise(resolve => setTimeout(resolve, 10));

        await projectToolsService.updatePreferredIDE(projectId, 'vscode');

        const updated = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

        expect(updated[0].updatedAt.getTime()).toBeGreaterThan(initialTime.getTime());
      });
    });

    describe('openProjectInIDE', () => {
      it('should open project with specified IDE', async () => {
        vi.mocked(ideDetectorService.openProjectInIDE).mockResolvedValue(undefined);

        await projectToolsService.openProjectInIDE('/project/path', 'cursor', 'vscode');

        expect(ideDetectorService.openProjectInIDE).toHaveBeenCalledWith('/project/path', 'vscode');
      });

      it('should use preferred IDE when no IDE is specified', async () => {
        vi.mocked(ideDetectorService.openProjectInIDE).mockResolvedValue(undefined);

        await projectToolsService.openProjectInIDE('/project/path', 'cursor');

        expect(ideDetectorService.openProjectInIDE).toHaveBeenCalledWith('/project/path', 'cursor');
      });

      it('should throw error when no IDE is specified and no preferred IDE', async () => {
        await expect(projectToolsService.openProjectInIDE('/project/path', null)).rejects.toThrow(
          'No IDE specified for this project'
        );

        expect(ideDetectorService.openProjectInIDE).not.toHaveBeenCalled();
      });
    });
  });

  describe('Terminal Management', () => {
    describe('getDetectedTerminals', () => {
      it('should return detected terminals from detector service', async () => {
        const mockTerminals = [
          { id: 'iterm', name: 'iTerm', isInstalled: true },
          { id: 'terminal', name: 'Terminal', isInstalled: true },
        ];

        vi.mocked(terminalDetectorService.detectInstalledTerminals).mockResolvedValue(
          mockTerminals
        );

        const result = await projectToolsService.getDetectedTerminals();

        expect(result).toEqual(mockTerminals);
        expect(terminalDetectorService.detectInstalledTerminals).toHaveBeenCalledOnce();
      });
    });

    describe('getAvailableTerminals', () => {
      it('should return available terminals from detector service', () => {
        const mockTerminals = [
          { id: 'iterm', name: 'iTerm', paths: ['/Applications/iTerm.app'] },
          { id: 'warp', name: 'Warp', paths: ['/Applications/Warp.app'] },
        ];

        vi.mocked(terminalDetectorService.getAvailableTerminals).mockReturnValue(mockTerminals);

        const result = projectToolsService.getAvailableTerminals();

        expect(result).toEqual(mockTerminals);
        expect(terminalDetectorService.getAvailableTerminals).toHaveBeenCalledOnce();
      });
    });

    describe('updatePreferredTerminal', () => {
      it('should update preferred terminal for a project', async () => {
        const projectId = 'test-project-123';

        await db.insert(projects).values({
          id: projectId,
          name: 'Test Project',
          path: '/test/path',
          preferredTerminal: null,
        });

        await projectToolsService.updatePreferredTerminal(projectId, 'iterm');

        const updated = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

        expect(updated[0].preferredTerminal).toBe('iterm');
      });

      it('should clear preferred terminal when null is provided', async () => {
        const projectId = 'test-project-456';

        await db.insert(projects).values({
          id: projectId,
          name: 'Test Project',
          path: '/test/path',
          preferredTerminal: 'warp',
        });

        await projectToolsService.updatePreferredTerminal(projectId, null);

        const updated = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

        expect(updated[0].preferredTerminal).toBeNull();
      });
    });

    describe('openTerminalAtProject', () => {
      it('should open terminal with specified terminal app', async () => {
        vi.mocked(terminalDetectorService.openTerminalAtPath).mockResolvedValue(undefined);

        await projectToolsService.openTerminalAtProject('/project/path', 'iterm', 'warp');

        expect(terminalDetectorService.openTerminalAtPath).toHaveBeenCalledWith(
          'warp',
          '/project/path'
        );
      });

      it('should use preferred terminal when no terminal is specified', async () => {
        vi.mocked(terminalDetectorService.openTerminalAtPath).mockResolvedValue(undefined);

        await projectToolsService.openTerminalAtProject('/project/path', 'iterm');

        expect(terminalDetectorService.openTerminalAtPath).toHaveBeenCalledWith(
          'iterm',
          '/project/path'
        );
      });

      it('should throw error when no terminal is specified and no preferred terminal', async () => {
        await expect(
          projectToolsService.openTerminalAtProject('/project/path', null)
        ).rejects.toThrow('No terminal specified for this project');

        expect(terminalDetectorService.openTerminalAtPath).not.toHaveBeenCalled();
      });
    });
  });
});
