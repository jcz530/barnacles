import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createIntegrationTestContext, mockDatabaseForIntegration } from '@test/contexts';
import { del, get, patch, post } from '@test/helpers/api-client';
import { setupProjectRoutes } from '@test/helpers/route-test-setup';
import { createProjectData, createProjectsData } from '@test/factories/project.factory';
import {
  projectProcessCommands,
  projectProcesses,
  projects as projectsSchema,
  projectTechnologies,
  technologies as technologiesSchema,
} from '@shared/database/schema';

// Mock the database connection module
mockDatabaseForIntegration();

describe('Projects API Integration Tests', () => {
  const context = createIntegrationTestContext();

  beforeEach(async () => {
    await setupProjectRoutes(context);
  });

  afterEach(async () => {
    await context.teardown();
  });

  describe('GET /api/projects', () => {
    it('should return empty array when no projects exist', async () => {
      const { app } = context.get();
      const response = await get(app, '/api/projects');

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('data');
      expect((response.data as any).data).toEqual([]);
    });

    it('should return all projects', async () => {
      const { db, app } = context.get();

      // Create test projects (ensure they're not archived)
      const projectsData = createProjectsData(3, { archivedAt: null });
      await db.insert(projectsSchema).values(projectsData);

      const response = await get(app, '/api/projects');

      expect(response.status).toBe(200);
      expect((response.data as any).data).toHaveLength(3);
    });

    it('should filter projects by search term', async () => {
      const { db, app } = context.get();

      // Create projects with specific names and paths to ensure deterministic search
      await db.insert(projectsSchema).values([
        createProjectData({
          name: 'my-awesome-app',
          path: '/projects/my-awesome-app',
          archivedAt: null,
        }),
        createProjectData({
          name: 'another-project',
          path: '/projects/another-project',
          archivedAt: null,
        }),
        createProjectData({
          name: 'awesome-website',
          path: '/projects/awesome-website',
          archivedAt: null,
        }),
      ]);

      const response = await get(app, '/api/projects?search=awesome');

      expect(response.status).toBe(200);
      const projects = (response.data as any).data;
      expect(projects).toHaveLength(2);
      expect(projects.every((p: any) => p.name.includes('awesome'))).toBe(true);
    });

    it('should filter projects by technology', async () => {
      const { db, app } = context.get();

      // Create technologies
      const [reactTech] = await db
        .insert(technologiesSchema)
        .values([
          { name: 'React', slug: 'react', color: '#61dafb' },
          { name: 'Vue', slug: 'vue', color: '#42b883' },
        ])
        .returning();

      // Create projects
      const [reactProject] = await db
        .insert(projectsSchema)
        .values([
          createProjectData({ name: 'react-app', archivedAt: null }),
          createProjectData({ name: 'vue-app', archivedAt: null }),
        ])
        .returning();

      // Associate React project with React technology
      await db.insert(projectTechnologies).values({
        projectId: reactProject.id,
        technologyId: reactTech.id,
      });

      const response = await get(app, '/api/projects?technologies=react');

      expect(response.status).toBe(200);
      const projects = (response.data as any).data;
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('react-app');
    });

    it('should exclude archived projects by default', async () => {
      const { db, app } = context.get();

      // Create archived and active projects
      await db
        .insert(projectsSchema)
        .values([
          createProjectData({ name: 'active-project', archivedAt: null }),
          createProjectData({ name: 'archived-project', archivedAt: new Date() }),
        ]);

      const response = await get(app, '/api/projects');

      expect(response.status).toBe(200);
      const projects = (response.data as any).data;
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('active-project');
    });

    it('should include archived projects when includeArchived=true', async () => {
      const { db, app } = context.get();

      // Create archived and active projects
      await db
        .insert(projectsSchema)
        .values([
          createProjectData({ name: 'active-project', archivedAt: null }),
          createProjectData({ name: 'archived-project', archivedAt: new Date() }),
        ]);

      const response = await get(app, '/api/projects?includeArchived=true');

      expect(response.status).toBe(200);
      const projects = (response.data as any).data;
      expect(projects).toHaveLength(2);
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('should delete a project', async () => {
      const { db, app } = context.get();

      // Create a project
      const [project] = await db.insert(projectsSchema).values(createProjectData()).returning();

      const response = await del(app, `/api/projects/${project.id}`);

      expect(response.status).toBe(200);
      expect((response.data as any).message).toBe('Project deleted successfully');

      // Verify project was deleted
      const projects = await db
        .select()
        .from(projectsSchema)
        .where(eq(projectsSchema.id, project.id));
      expect(projects).toHaveLength(0);
    });
  });

  describe('PATCH /api/projects/:id/favorite', () => {
    it('should toggle project favorite status', async () => {
      const { db, app } = context.get();

      // Create a project
      const [project] = await db
        .insert(projectsSchema)
        .values(createProjectData({ isFavorite: false }))
        .returning();

      // Toggle to favorite
      const response = await patch(app, `/api/projects/${project.id}/favorite`);

      expect(response.status).toBe(200);
      expect((response.data as any).data.isFavorite).toBe(true);
      expect((response.data as any).message).toContain('added to');

      // Verify in database
      const [updated] = await db.select().from(projectsSchema);
      expect(updated.isFavorite).toBe(true);
    });
  });

  describe('PATCH /api/projects/:id/archive', () => {
    it('should archive a project', async () => {
      const { db, app } = context.get();

      // Create an active project
      const [project] = await db
        .insert(projectsSchema)
        .values(createProjectData({ archivedAt: null }))
        .returning();

      const response = await patch(app, `/api/projects/${project.id}/archive`);

      expect(response.status).toBe(200);
      expect((response.data as any).message).toBe('Project archived successfully');

      // Verify project was archived
      const [archived] = await db.select().from(projectsSchema);
      expect(archived.archivedAt).not.toBeNull();
    });
  });

  describe('PATCH /api/projects/:id/unarchive', () => {
    it('should unarchive a project', async () => {
      const { db, app } = context.get();

      // Create an archived project
      const [project] = await db
        .insert(projectsSchema)
        .values(createProjectData({ archivedAt: new Date() }))
        .returning();

      const response = await patch(app, `/api/projects/${project.id}/unarchive`);

      expect(response.status).toBe(200);
      expect((response.data as any).message).toBe('Project unarchived successfully');

      // Verify project was unarchived
      const [unarchived] = await db.select().from(projectsSchema);
      expect(unarchived.archivedAt).toBeNull();
    });
  });

  /**
   * The command palette keeps projects that cannot start out of its Start rows,
   * and it reads this flag from the list rather than fetching each project's
   * processes. A project with no configured process has to come back false --
   * not absent -- or an unstartable project gets a Start row that fails on use.
   */
  describe('hasStartProcesses', () => {
    /** Give a project one configured process, with a command behind it. */
    const configureProcess = async (db: any, projectId: string) => {
      const [process] = await db
        .insert(projectProcesses)
        .values({ id: `dev-${projectId}`, projectId, name: 'Dev Server', order: 0 })
        .returning();

      await db
        .insert(projectProcessCommands)
        .values({ processId: process.id, command: 'npm run dev', order: 0 });
    };

    it('should be false for a project with no configured processes', async () => {
      const { db, app } = context.get();

      await db.insert(projectsSchema).values(createProjectData({ archivedAt: null }));

      const response = await get(app, '/api/projects');

      expect(response.status).toBe(200);
      expect((response.data as any).data[0].hasStartProcesses).toBe(false);
    });

    it('should be true for a project with a configured process', async () => {
      const { db, app } = context.get();

      const [project] = await db
        .insert(projectsSchema)
        .values(createProjectData({ archivedAt: null }))
        .returning();
      await configureProcess(db, project.id);

      const response = await get(app, '/api/projects');

      expect(response.status).toBe(200);
      expect((response.data as any).data[0].hasStartProcesses).toBe(true);
    });

    /**
     * The flag is per project, not per list: one configured project must not
     * make its neighbours look startable. This is what a grouped query gets
     * wrong most easily.
     */
    it('should only be true for the projects that have processes', async () => {
      const { db, app } = context.get();

      const [withProcess] = await db
        .insert(projectsSchema)
        .values(createProjectData({ name: 'has-process', archivedAt: null }))
        .returning();
      const [without] = await db
        .insert(projectsSchema)
        .values(createProjectData({ name: 'no-process', archivedAt: null }))
        .returning();

      await configureProcess(db, withProcess.id);

      const response = await get(app, '/api/projects');
      const byId = new Map(
        (response.data as any).data.map((project: any) => [project.id, project.hasStartProcesses])
      );

      expect(response.status).toBe(200);
      expect(byId.get(withProcess.id)).toBe(true);
      expect(byId.get(without.id)).toBe(false);
    });

    it('should be present on a single project fetched by ID', async () => {
      const { db, app } = context.get();

      const [project] = await db
        .insert(projectsSchema)
        .values(createProjectData({ archivedAt: null }))
        .returning();

      const before = await get(app, `/api/projects/${project.id}`);
      expect((before.data as any).data.hasStartProcesses).toBe(false);

      await configureProcess(db, project.id);

      const after = await get(app, `/api/projects/${project.id}`);
      expect((after.data as any).data.hasStartProcesses).toBe(true);
    });
  });

  describe('GET /api/projects/:id', () => {
    it('should return a single project by ID', async () => {
      const { db, app } = context.get();

      // Create a project
      const [project] = await db
        .insert(projectsSchema)
        .values(createProjectData({ name: 'test-project' }))
        .returning();

      const response = await get(app, `/api/projects/${project.id}`);

      expect(response.status).toBe(200);
      expect((response.data as any).data).toBeDefined();
      expect((response.data as any).data.id).toBe(project.id);
      expect((response.data as any).data.name).toBe('test-project');
    });

    it('should return 404 for non-existent project', async () => {
      const { app } = context.get();

      const response = await get(app, '/api/projects/non-existent-id');

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/projects/:id/rescan', () => {
    it('should rescan a project and return updated data', async () => {
      const { db, app } = context.get();

      // Create a project with a valid path (use current directory as test)
      const [project] = await db
        .insert(projectsSchema)
        .values(createProjectData({ path: process.cwd() }))
        .returning();

      const response = await post(app, `/api/projects/${project.id}/rescan`);

      expect(response.status).toBe(200);
      expect((response.data as any).message).toBe('Project rescanned successfully');
      expect((response.data as any).data).toBeDefined();
    });

    it('should return 404 for non-existent project', async () => {
      const { app } = context.get();

      const response = await post(app, '/api/projects/non-existent-id/rescan');

      expect(response.status).toBe(404);
    });
  });
});
