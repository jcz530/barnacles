import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createUnitTestContext, mockDatabaseForUnit } from '@test/contexts';
import { DEMO_PROJECTS, DEMO_FEATURED_PROJECT_ID } from '@shared/database/demo/data/projects';
import { DEMO_STATS } from '@shared/database/demo/data/stats';
import { DEMO_PROCESSES } from '@shared/database/demo/data/processes';
import { DEMO_WORKTREES } from '@shared/database/demo/data/worktrees';
import { TECHNOLOGY_DETECTORS } from '@backend/services/technology-detectors';

mockDatabaseForUnit();

/**
 * The guard tests below are the reason this file exists: they prove demo data
 * cannot be written into a database outside a .demo-data profile.
 */
describe('demo seed', () => {
  const context = createUnitTestContext();

  beforeEach(async () => {
    await context.setup();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  describe('safety guards', () => {
    it('throws when demo mode is not enabled', async () => {
      vi.stubEnv('BARNACLES_DEMO', '');
      const { seedDemoDatabase } = await import('@shared/database/demo');

      await expect(seedDemoDatabase()).rejects.toThrow(/outside demo mode/i);
    });

    it('throws when the demo flag is set without a demo profile', async () => {
      // The flag alone must not enable demo mode: the other demo guards would
      // otherwise show fabricated data on top of the real database.
      vi.stubEnv('BARNACLES_DEMO', '1');
      vi.stubEnv('BARNACLES_DATA_DIR', '');

      const { seedDemoDatabase } = await import('@shared/database/demo');
      await expect(seedDemoDatabase()).rejects.toThrow(/outside demo mode/i);
    });

    it('refuses to seed a database outside a .demo-data directory', async () => {
      // Defense in depth: demo mode is on, but the resolved database path is not
      // inside the profile.
      vi.stubEnv('BARNACLES_DEMO', '1');
      vi.stubEnv('BARNACLES_DATA_DIR', '/tmp/barnacles-guard-test/.demo-data');
      vi.doMock('@shared/database/connection', async () => {
        const actual = await vi.importActual<typeof import('@shared/database/connection')>(
          '@shared/database/connection'
        );
        return { ...actual, getResolvedDatabasePath: () => '/Users/dev/barnacles/database.db' };
      });

      const { seedDemoDatabase } = await import('@shared/database/demo');
      await expect(seedDemoDatabase()).rejects.toThrow(/non-demo database/i);
    });

    it('names the offending path so the failure is diagnosable', async () => {
      vi.stubEnv('BARNACLES_DEMO', '1');
      vi.stubEnv('BARNACLES_DATA_DIR', '/tmp/barnacles-guard-test/.demo-data');
      vi.doMock('@shared/database/connection', async () => {
        const actual = await vi.importActual<typeof import('@shared/database/connection')>(
          '@shared/database/connection'
        );
        return { ...actual, getResolvedDatabasePath: () => '/tmp/somewhere/database.db' };
      });

      const { seedDemoDatabase } = await import('@shared/database/demo');
      await expect(seedDemoDatabase()).rejects.toThrow(/\/tmp\/somewhere\/database\.db/);
    });

    it('does not mistake a lookalike directory for a demo profile', async () => {
      // ".demo-database" contains ".demo-data" as a substring but is not a
      // demo profile — the check must be path-component aware.
      vi.stubEnv('BARNACLES_DEMO', '1');
      vi.stubEnv('BARNACLES_DATA_DIR', '/Users/dev/projects/my.demo-database');

      const { seedDemoDatabase } = await import('@shared/database/demo');
      await expect(seedDemoDatabase()).rejects.toThrow(/outside demo mode/i);
    });
  });

  describe('fixture integrity', () => {
    it('gives every project a unique, stable id', () => {
      const ids = DEMO_PROJECTS.map(p => p.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids).toContain(DEMO_FEATURED_PROJECT_ID);
    });

    it('gives every project a unique path', () => {
      const paths = DEMO_PROJECTS.map(p => p.path);
      expect(new Set(paths).size).toBe(paths.length);
    });

    it('never leaks a real home directory into a fixture path', () => {
      // Seeded rows use an on-disk path under the demo profile (see
      // workspace.ts); the fixture path is the cosmetic fallback. Neither may
      // reference the capturing machine's home directory.
      for (const project of DEMO_PROJECTS) {
        expect(project.path.startsWith('/Users/dev/')).toBe(true);
      }
    });

    it('places the on-disk workspace inside the app data dir, under the project name', async () => {
      // Test mode keeps getAppDataDir pointed at a tmp dir, so this asserts the
      // workspace is nested inside whatever profile is active — not a hardcoded
      // .demo-data string.
      const { demoProjectPath, getDemoWorkspaceRoot } =
        await import('@shared/database/demo/workspace');

      const resolved = demoProjectPath('harbor-api');
      expect(resolved.startsWith(getDemoWorkspaceRoot())).toBe(true);
      expect(resolved.endsWith('harbor-api')).toBe(true);
    });

    it('attaches every extra worktree to a real project', () => {
      const projectIds = new Set(DEMO_PROJECTS.map(p => p.id));
      const orphans = DEMO_WORKTREES.filter(w => !projectIds.has(w.projectId));

      expect(orphans).toEqual([]);
    });

    it('gives every worktree a unique directory', () => {
      // projectWorktrees.path is globally unique, so a duplicate would fail the
      // seed on the unique index.
      const dirs = DEMO_WORKTREES.map(w => w.directory);
      expect(new Set(dirs).size).toBe(dirs.length);
    });

    it('never collides an extra worktree with a project directory', () => {
      // Both resolve under the same demo workspace root, so a shared name would
      // put a worktree at its project's own path.
      const projectNames = new Set(DEMO_PROJECTS.map(p => p.name));
      const collisions = DEMO_WORKTREES.filter(w => projectNames.has(w.directory));

      expect(collisions).toEqual([]);
    });

    it('uses a bare directory name, not a path', () => {
      // The seeder resolves these under the demo workspace; a path here would
      // either escape it or land somewhere that does not exist on disk.
      for (const worktree of DEMO_WORKTREES) {
        expect(worktree.directory).not.toContain('/');
      }
    });

    it('gives at least one project enough worktrees to exercise the list view', () => {
      // A single checkout renders the summary, not the list -- demo mode should
      // show the multi-worktree view the feature exists for.
      const countByProject = new Map<string, number>();
      for (const worktree of DEMO_WORKTREES) {
        countByProject.set(worktree.projectId, (countByProject.get(worktree.projectId) ?? 0) + 1);
      }

      // +1 for the main worktree each project gets from its stats fixture.
      const largest = Math.max(...countByProject.values()) + 1;
      expect(largest).toBeGreaterThanOrEqual(3);
    });

    it('covers a detached HEAD', () => {
      expect(DEMO_WORKTREES.some(w => w.branch === null)).toBe(true);
    });

    it('only references technology slugs the app knows about', () => {
      const known = new Set(TECHNOLOGY_DETECTORS.map(d => d.slug));
      for (const project of DEMO_PROJECTS) {
        for (const slug of project.technologies) {
          expect(known, `${project.name} references unknown slug "${slug}"`).toContain(slug);
        }
      }
    });

    it('has language percentages totalling 100% per project', () => {
      for (const stats of DEMO_STATS) {
        const total = stats.languages.reduce((sum, l) => sum + l.percentage, 0);
        expect(total, `${stats.projectId} percentages should total 1000`).toBe(1000);
      }
    });

    it('attaches stats to real projects only', () => {
      const projectIds = new Set(DEMO_PROJECTS.map(p => p.id));
      for (const stats of DEMO_STATS) {
        expect(projectIds).toContain(stats.projectId);
      }
    });

    it('attaches processes to real projects and gives each a command', () => {
      const projectIds = new Set(DEMO_PROJECTS.map(p => p.id));
      const processIds = DEMO_PROCESSES.map(p => p.id);

      expect(new Set(processIds).size).toBe(processIds.length);
      for (const process of DEMO_PROCESSES) {
        expect(projectIds).toContain(process.projectId);
        expect(process.commands.length).toBeGreaterThan(0);
      }
    });

    it('gives the featured project enough content to fill its detail tabs', () => {
      const featured = DEMO_PROJECTS.find(p => p.id === DEMO_FEATURED_PROJECT_ID);
      const stats = DEMO_STATS.find(s => s.projectId === DEMO_FEATURED_PROJECT_ID);
      const processes = DEMO_PROCESSES.filter(p => p.projectId === DEMO_FEATURED_PROJECT_ID);

      expect(featured).toBeDefined();
      expect(stats).toBeDefined();
      expect(stats!.languages.length).toBeGreaterThan(1);
      expect(processes.length).toBeGreaterThan(1);
    });
  });
});
