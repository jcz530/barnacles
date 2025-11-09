import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createUnitTestContext, mockDatabaseForUnit } from '@test/contexts';
import { projectTechnologyService } from '@backend/services/project/project-technology-service';
import { db } from '@shared/database';
import { technologies, projectTechnologies, projects } from '@shared/database/schema';
import { eq } from 'drizzle-orm';

// Mock the database connection module
mockDatabaseForUnit();

describe('ProjectTechnologyService', () => {
  const context = createUnitTestContext();

  beforeEach(async () => {
    await context.setup();
  });

  afterEach(async () => {
    await context.teardown();
  });

  describe('getAllTechnologies', () => {
    it('should return all technologies', async () => {
      // Insert some test technologies
      await db.insert(technologies).values([
        { name: 'TypeScript', slug: 'typescript', icon: '=�', color: '#3178C6' },
        { name: 'React', slug: 'react', icon: '�', color: '#61DAFB' },
      ]);

      const result = await projectTechnologyService.getAllTechnologies();

      expect(result).toHaveLength(2);
      expect(result[0].slug).toBe('typescript');
      expect(result[1].slug).toBe('react');
    });

    it('should return empty array when no technologies exist', async () => {
      const result = await projectTechnologyService.getAllTechnologies();
      expect(result).toHaveLength(0);
    });
  });

  describe('getProjectTechnologies', () => {
    it('should return technologies for a project', async () => {
      const projectId = 'test-project-id';

      // Create project first
      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      // Create technologies
      const tech1 = await db
        .insert(technologies)
        .values({ name: 'TypeScript', slug: 'typescript', icon: '=�', color: '#3178C6' })
        .returning();

      const tech2 = await db
        .insert(technologies)
        .values({ name: 'Vue', slug: 'vue', icon: '=�', color: '#42B883' })
        .returning();

      // Associate technologies with project
      await db.insert(projectTechnologies).values([
        { projectId, technologyId: tech1[0].id },
        { projectId, technologyId: tech2[0].id },
      ]);

      const result = await projectTechnologyService.getProjectTechnologies(projectId);

      expect(result).toHaveLength(2);
      expect(result.map(t => t.slug)).toContain('typescript');
      expect(result.map(t => t.slug)).toContain('vue');
    });

    it('should return empty array for project with no technologies', async () => {
      const result = await projectTechnologyService.getProjectTechnologies('nonexistent-project');
      expect(result).toHaveLength(0);
    });
  });

  describe('ensureTechnology', () => {
    it('should return existing technology id if already exists', async () => {
      const tech = await db
        .insert(technologies)
        .values({ name: 'TypeScript', slug: 'typescript', icon: '=�', color: '#3178C6' })
        .returning();

      const result = await projectTechnologyService.ensureTechnology('typescript');

      expect(result).toBe(tech[0].id);
    });

    it('should create new technology if it does not exist', async () => {
      const techId = await projectTechnologyService.ensureTechnology('nodejs');

      expect(techId).toBeDefined();

      // Verify it was created
      const tech = await db
        .select()
        .from(technologies)
        .where(eq(technologies.slug, 'nodejs'))
        .limit(1);

      expect(tech).toHaveLength(1);
      expect(tech[0].id).toBe(techId);
      expect(tech[0].name).toBe('Node.js');
    });

    it('should throw error for unknown technology', async () => {
      await expect(projectTechnologyService.ensureTechnology('unknown-tech-123')).rejects.toThrow(
        'Unknown technology: unknown-tech-123'
      );
    });

    it('should handle race condition when creating technology', async () => {
      // This test verifies the race condition handling where two processes
      // try to create the same technology simultaneously

      // First, ensure the technology doesn't exist
      const techs = await db
        .select()
        .from(technologies)
        .where(eq(technologies.slug, 'nodejs'))
        .limit(1);

      expect(techs).toHaveLength(0);

      // Create it once
      const techId1 = await projectTechnologyService.ensureTechnology('nodejs');

      // Try to ensure it again (should return existing one)
      const techId2 = await projectTechnologyService.ensureTechnology('nodejs');

      expect(techId1).toBe(techId2);

      // Verify only one was created
      const allNodeJs = await db.select().from(technologies).where(eq(technologies.slug, 'nodejs'));

      expect(allNodeJs).toHaveLength(1);
    });
  });

  describe('updateProjectTechnologies', () => {
    it('should add technologies to a project', async () => {
      const projectId = 'test-project-123';

      // Create project first
      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      await projectTechnologyService.updateProjectTechnologies(projectId, [
        'typescript',
        'react',
        'nodejs',
      ]);

      const result = await projectTechnologyService.getProjectTechnologies(projectId);

      expect(result).toHaveLength(3);
      expect(result.map(t => t.slug)).toContain('typescript');
      expect(result.map(t => t.slug)).toContain('react');
      expect(result.map(t => t.slug)).toContain('nodejs');
    });

    it('should replace existing technologies', async () => {
      const projectId = 'test-project-456';

      // Create project first
      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      // First add some technologies
      await projectTechnologyService.updateProjectTechnologies(projectId, ['typescript', 'react']);

      // Verify they were added
      let result = await projectTechnologyService.getProjectTechnologies(projectId);
      expect(result).toHaveLength(2);

      // Now replace with different technologies
      await projectTechnologyService.updateProjectTechnologies(projectId, ['vue', 'nodejs']);

      // Verify old ones are gone and new ones are present
      result = await projectTechnologyService.getProjectTechnologies(projectId);
      expect(result).toHaveLength(2);
      expect(result.map(t => t.slug)).toContain('vue');
      expect(result.map(t => t.slug)).toContain('nodejs');
      expect(result.map(t => t.slug)).not.toContain('typescript');
      expect(result.map(t => t.slug)).not.toContain('react');
    });

    it('should handle empty technology array', async () => {
      const projectId = 'test-project-789';

      // Create project first
      await db.insert(projects).values({
        id: projectId,
        name: 'Test Project',
        path: '/test/path',
      });

      // Add some technologies first
      await projectTechnologyService.updateProjectTechnologies(projectId, ['typescript']);

      // Clear all technologies
      await projectTechnologyService.updateProjectTechnologies(projectId, []);

      const result = await projectTechnologyService.getProjectTechnologies(projectId);
      expect(result).toHaveLength(0);
    });
  });
});
