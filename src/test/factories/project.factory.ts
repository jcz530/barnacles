import { faker } from '@faker-js/faker';
import type { projects } from '@shared/database/schema';

type NewProject = typeof projects.$inferInsert;

/**
 * Generates a realistic project object for testing
 */
export function createProjectData(overrides?: Partial<NewProject>): NewProject {
  const projectName = faker.helpers.arrayElement([
    faker.commerce.productName().toLowerCase().replace(/\s+/g, '-'),
    faker.internet.domainWord(),
    faker.hacker.noun().replace(/\s+/g, '-'),
  ]);

  return {
    name: projectName,
    path: faker.system.directoryPath() + '/' + projectName,
    description: faker.lorem.sentence(),
    icon: faker.helpers.maybe(() => 'logo.png', { probability: 0.3 }),
    lastModified: faker.date.recent({ days: 30 }),
    size: faker.number.int({ min: 1000000, max: 500000000 }),
    isFavorite: faker.datatype.boolean({ probability: 0.2 }),
    archivedAt: faker.helpers.maybe(() => faker.date.recent({ days: 7 }), { probability: 0.1 }),
    preferredIde: faker.helpers.maybe(
      () => faker.helpers.arrayElement(['vscode', 'cursor', 'webstorm']),
      { probability: 0.5 }
    ),
    preferredTerminal: faker.helpers.maybe(
      () => faker.helpers.arrayElement(['terminal', 'iterm', 'warp']),
      { probability: 0.5 }
    ),
    ...overrides,
  };
}

/**
 * Generates multiple project objects for testing
 */
export function createProjectsData(count: number, overrides?: Partial<NewProject>): NewProject[] {
  return Array.from({ length: count }, () => createProjectData(overrides));
}
