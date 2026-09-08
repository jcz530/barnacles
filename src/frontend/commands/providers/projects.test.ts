import { describe, expect, it, vi } from 'vitest';
import type { ProjectWithDetails } from '../../../shared/types/api';
import { projectCommands } from './projects';

const deps = () => ({
  openInIde: vi.fn(),
  openTerminal: vi.fn(),
  revealInFinder: vi.fn(),
  copyPath: vi.fn(),
});

const project = (overrides: Partial<ProjectWithDetails> = {}): ProjectWithDetails =>
  ({
    id: 'p1',
    name: 'Alchemy',
    path: '/Users/dev/alchemy',
    isFavorite: false,
    technologies: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as ProjectWithDetails;

const openCommand = (projects: ProjectWithDetails[]) =>
  projectCommands(projects, deps()).find(command => command.id.startsWith('project.open:'));

describe('projectCommands', () => {
  it('renders a project with its own icon, matching the projects page', () => {
    const command = openCommand([project({ icon: 'icon.png' })]);

    expect(command?.projectIcon).toEqual({
      projectId: 'p1',
      projectName: 'Alchemy',
      hasIcon: true,
    });
  });

  it('falls back to the folder glyph when a project has no icon', () => {
    // ProjectIcon renders <Folder> when hasIcon is false, so the flag is what
    // decides between a real icon and the fallback.
    const command = openCommand([project({ icon: null })]);

    expect(command?.projectIcon).toMatchObject({ hasIcon: false });
  });

  it('keeps action glyphs on the per-project actions', () => {
    // "Open in IDE" should say what it does, not repeat which project it is --
    // the title already carries the name.
    const commands = projectCommands([project()], deps());
    const ide = commands.find(command => command.id.startsWith('project.open-ide:'));

    expect(ide?.projectIcon).toBeUndefined();
    expect(ide?.icon).toBeDefined();
  });
});
