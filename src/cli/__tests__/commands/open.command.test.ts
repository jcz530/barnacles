import { describe, expect, it, vi, beforeEach } from 'vitest';
import { OpenCommand } from '@cli/commands/open';
import { apiClient } from '@cli/utils/api-client.js';
import type { ProjectWithDetails } from '@shared/types/api';

vi.mock('@clack/prompts', () => ({
  log: {
    success: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    message: vi.fn(),
    step: vi.fn(),
  },
}));

vi.mock('@cli/utils/api-client.js', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

function project(overrides: Partial<ProjectWithDetails> = {}): ProjectWithDetails {
  return {
    id: 'proj-1',
    name: 'My Project',
    path: '/Users/dev/my-project',
    isFavorite: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as ProjectWithDetails;
}

describe('OpenCommand', () => {
  beforeEach(() => {
    vi.mocked(apiClient.get).mockReset();
    vi.mocked(apiClient.post).mockReset();
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
  });

  describe('command metadata', () => {
    it('should have correct name and aliases', () => {
      const command = new OpenCommand();

      expect(command.name).toBe('open');
      expect(command.aliases).toContain('o');
    });
  });

  describe('execute with a project query', () => {
    it('focuses the app on an exact name match', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([
        project({ id: 'proj-1', name: 'My Project' }),
        project({ id: 'proj-2', name: 'Other' }),
      ]);
      vi.mocked(apiClient.post).mockResolvedValue(undefined);

      const command = new OpenCommand();
      await command.execute({}, ['My Project']);

      expect(apiClient.post).toHaveBeenCalledWith('/api/system/focus-project', {
        path: '/projects/proj-1/overview',
      });
    });

    it('matches case-insensitively on a partial name', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([project({ id: 'proj-1', name: 'Barnacles' })]);
      vi.mocked(apiClient.post).mockResolvedValue(undefined);

      const command = new OpenCommand();
      await command.execute({}, ['barn']);

      expect(apiClient.post).toHaveBeenCalledWith('/api/system/focus-project', {
        path: '/projects/proj-1/overview',
      });
    });

    it('exits with an error when no project matches', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([project({ id: 'proj-1', name: 'Barnacles' })]);

      const command = new OpenCommand();
      await command.execute({}, ['nonexistent']);

      expect(process.exit).toHaveBeenCalledWith(1);
      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('exits with an error when the backend is unreachable', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('connection refused'));

      const command = new OpenCommand();
      await command.execute({}, ['My Project']);

      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
