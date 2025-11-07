import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { createIntegrationTestContext, mockDatabaseForIntegration } from '@test/contexts';
import { del, get, patch } from '@test/helpers/api-client';
import { createProjectData, createProjectsData } from '@test/factories/project.factory';
import {
  projects as projectsSchema,
  projectTechnologies,
  technologies as technologiesSchema,
} from '@shared/database/schema';

// Mock the database connection module
mockDatabaseForIntegration();

describe('Projects API Integration Tests', () => {
  const context = createIntegrationTestContext();

  beforeEach(async () => {
    await context.setup(async () => {
      // Import routes and create app
      const projectsRoute = await import('@backend/routes/projects');
      const apiRoutes = new Hono();
      apiRoutes.route('/api/projects', projectsRoute.default);
      return apiRoutes;
    });
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

      // Create projects with specific names
      await db
        .insert(projectsSchema)
        .values([
          createProjectData({ name: 'my-awesome-app' }),
          createProjectData({ name: 'another-project' }),
          createProjectData({ name: 'awesome-website' }),
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
        .values([createProjectData({ name: 'react-app' }), createProjectData({ name: 'vue-app' })])
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
});
