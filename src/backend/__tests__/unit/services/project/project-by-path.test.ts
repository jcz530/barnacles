import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createUnitTestContext, mockDatabaseForUnit } from '@test/contexts';
import { projectService } from '@backend/services/project';
import { db } from '@shared/database';
import { projects, projectWorktrees } from '@shared/database/schema';

mockDatabaseForUnit();

/**
 * getProjectByPath backs GET /api/projects/meta/by-path, which is what the MCP
 * get_project_by_path tool and the CLI call. Once a linked worktree stops being
 * its own project row, resolving from inside that worktree only works if
 * worktree paths are part of the candidate set -- so pin that here.
 */
describe('projectService.getProjectByPath', () => {
  const context = createUnitTestContext();

  beforeEach(async () => {
    await context.setup();
  });

  afterEach(async () => {
    await context.teardown();
  });

  async function seed(): Promise<void> {
    await db.insert(projects).values([
      { id: 'barnacles', name: 'Barnacles', path: '/Users/dev/Development/barnacles' },
      { id: 'marketing', name: 'Marketing', path: '/Users/dev/Development/barnacles-marketing' },
    ]);

    // The three worktree layouts that exist in practice: the main checkout, a
    // sibling directory, and a worktree under an entirely separate root.
    await db.insert(projectWorktrees).values([
      {
        projectId: 'barnacles',
        path: '/Users/dev/Development/barnacles',
        isMain: true,
        branch: 'main',
      },
      {
        projectId: 'barnacles',
        path: '/Users/dev/Development/barnacles-port-change',
        isMain: false,
        branch: 'feat/ports',
      },
      {
        projectId: 'barnacles',
        path: '/Users/dev/orca/workspaces/barnacles/ports',
        isMain: false,
        branch: 'ports',
      },
    ]);
  }

  it('resolves the project root itself', async () => {
    await seed();

    const project = await projectService.getProjectByPath('/Users/dev/Development/barnacles');

    expect(project?.id).toBe('barnacles');
  });

  it('resolves a sibling worktree to its project', async () => {
    await seed();

    const project = await projectService.getProjectByPath(
      '/Users/dev/Development/barnacles-port-change'
    );

    expect(project?.id).toBe('barnacles');
  });

  it('resolves a worktree under a separate root to its project', async () => {
    await seed();

    const project = await projectService.getProjectByPath(
      '/Users/dev/orca/workspaces/barnacles/ports'
    );

    expect(project?.id).toBe('barnacles');
  });

  it('resolves a file inside a worktree to its project', async () => {
    await seed();

    const project = await projectService.getProjectByPath(
      '/Users/dev/Development/barnacles-port-change/src/main.ts'
    );

    expect(project?.id).toBe('barnacles');
  });

  it('does not let a worktree path swallow a longer project path', async () => {
    await seed();

    // barnacles-marketing shares the 'barnacles' prefix but is its own project.
    // Longest-prefix wins, so it must not resolve to barnacles.
    const project = await projectService.getProjectByPath(
      '/Users/dev/Development/barnacles-marketing'
    );

    expect(project?.id).toBe('marketing');
  });

  it('returns null for an unrelated path', async () => {
    await seed();

    const project = await projectService.getProjectByPath('/Users/dev/Development/something-else');

    expect(project).toBeNull();
  });

  it('stops resolving a worktree once its project is deleted', async () => {
    await seed();

    // better-sqlite3 enables foreign_keys by default, so deleting the project
    // cascades its worktree rows away and the path stops resolving.
    await projectService.deleteProject('barnacles');

    const project = await projectService.getProjectByPath(
      '/Users/dev/Development/barnacles-port-change'
    );

    expect(project).toBeNull();
    expect(await db.select().from(projectWorktrees)).toEqual([]);
  });
});
