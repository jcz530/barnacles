import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createIntegrationTestContext, mockDatabaseForIntegration } from '@test/contexts';
import { get } from '@test/helpers/api-client';
import { setupProjectRoutes } from '@test/helpers/route-test-setup';
import { technologies as technologiesSchema } from '@shared/database/schema';

// Mock the database connection module
mockDatabaseForIntegration();

describe('Projects Technologies API Integration Tests', () => {
  const context = createIntegrationTestContext();

  beforeEach(async () => {
    await setupProjectRoutes(context);
  });

  afterEach(async () => {
    await context.teardown();
  });

  describe('GET /api/projects/meta/technologies', () => {
    it('should return empty array when no technologies exist', async () => {
      const { app } = context.get();
      const response = await get(app, '/api/projects/meta/technologies');

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('data');
      expect((response.data as any).data).toEqual([]);
    });

    it('should return all technologies', async () => {
      const { db, app } = context.get();

      // Create test technologies
      const technologiesData = [
        { name: 'React', slug: 'react', color: '#61dafb' },
        { name: 'Vue', slug: 'vue', color: '#42b883' },
        { name: 'Angular', slug: 'angular', color: '#dd0031' },
      ];
      await db.insert(technologiesSchema).values(technologiesData);

      const response = await get(app, '/api/projects/meta/technologies');

      expect(response.status).toBe(200);
      const technologies = (response.data as any).data;
      expect(technologies).toHaveLength(3);
      expect(technologies.map((t: any) => t.name)).toEqual(
        expect.arrayContaining(['React', 'Vue', 'Angular'])
      );
    });

    it('should return technologies with correct properties', async () => {
      const { db, app } = context.get();

      // Create a technology
      await db.insert(technologiesSchema).values({
        name: 'TypeScript',
        slug: 'typescript',
        color: '#3178c6',
      });

      const response = await get(app, '/api/projects/meta/technologies');

      expect(response.status).toBe(200);
      const technologies = (response.data as any).data;
      expect(technologies).toHaveLength(1);
      expect(technologies[0]).toMatchObject({
        name: 'TypeScript',
        slug: 'typescript',
        color: '#3178c6',
      });
    });
  });
});
