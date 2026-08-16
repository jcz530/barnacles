import { eq } from 'drizzle-orm';
import { db } from '../connection';
import { getResolvedDatabasePath } from '../connection';
import { DEMO_DATA_DIRNAME } from '../paths';
import { isDemoMode } from '../../config/runtime-mode';
import {
  projects,
  projectLanguageStats,
  projectProcessCommands,
  projectProcesses,
  projectRelatedFolders,
  projectStats,
  projectTechnologies,
  technologies,
  aliases,
} from '../schema';
import { TECHNOLOGY_DETECTORS } from '../../../backend/services/technology-detectors';
import { createAccount } from '../../../backend/services/account-service';
import { DEMO_PROJECTS, DEMO_PATH_ROOT } from './data/projects';
import { DEMO_STATS } from './data/stats';
import { DEMO_PROCESSES } from './data/processes';
import { DEMO_ACCOUNTS } from './data/accounts';
import { DEMO_ALIASES } from './data/aliases';

/**
 * Anchor for all demo timestamps. Frozen at seed time so relative copy
 * ("2 days ago") stays truthful without ever rendering a stale absolute date
 * in a published screenshot.
 */
const DEMO_NOW = new Date();

function daysAgo(days: number): Date {
  return new Date(DEMO_NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

/**
 * Refuse to write demo data anywhere but a disposable demo profile.
 *
 * This is the backstop for the case where BARNACLES_DEMO=1 is set without
 * BARNACLES_DATA_DIR: under NODE_ENV=development the database would otherwise
 * resolve to ./database.db, the real dev database.
 */
function assertSafeToSeed(): void {
  if (!isDemoMode()) {
    throw new Error('seedDemoDatabase called outside demo mode (BARNACLES_DEMO is not set)');
  }

  const dbPath = getResolvedDatabasePath();
  if (!dbPath.includes(DEMO_DATA_DIRNAME)) {
    throw new Error(
      `Refusing to seed demo data into a non-demo database: ${dbPath}\n` +
        `Demo mode requires BARNACLES_DATA_DIR to point at a "${DEMO_DATA_DIRNAME}" directory.`
    );
  }
}

/** Technology metadata (name, icon, colour) sourced from the app's own catalog. */
function technologyRecordFor(slug: string) {
  const detector = TECHNOLOGY_DETECTORS.find(d => d.slug === slug);
  if (!detector) {
    throw new Error(`Demo fixture references unknown technology slug: ${slug}`);
  }
  return {
    name: detector.name,
    slug: detector.slug,
    icon: detector.icon ?? null,
    color: detector.color ?? null,
  };
}

/**
 * Remove any previously seeded demo rows so re-seeding is idempotent. Scoped to
 * the demo database, which assertSafeToSeed has already verified.
 */
async function clearExistingDemoData(): Promise<void> {
  // Child rows cascade from projects, so deleting projects is sufficient for
  // stats/technologies/processes/accounts. Aliases have no parent.
  for (const project of DEMO_PROJECTS) {
    await db.delete(projects).where(eq(projects.id, project.id));
  }
  for (const alias of DEMO_ALIASES) {
    await db.delete(aliases).where(eq(aliases.name, alias.name));
  }
}

async function seedProjects(): Promise<void> {
  for (const project of DEMO_PROJECTS) {
    await db.insert(projects).values({
      id: project.id,
      name: project.name,
      path: project.path,
      description: project.description,
      lastModified: daysAgo(project.lastModifiedDaysAgo),
      size: project.size,
      isFavorite: project.isFavorite,
      preferredIde: project.preferredIde ?? null,
      preferredTerminal: project.preferredTerminal ?? null,
      createdAt: daysAgo(project.createdDaysAgo),
      updatedAt: daysAgo(project.lastModifiedDaysAgo),
    });
  }
}

async function seedTechnologies(): Promise<void> {
  const slugs = [...new Set(DEMO_PROJECTS.flatMap(p => p.technologies))];

  for (const slug of slugs) {
    const record = technologyRecordFor(slug);
    await db
      .insert(technologies)
      .values({ ...record, createdAt: DEMO_NOW, updatedAt: DEMO_NOW })
      .onConflictDoNothing();
  }

  const rows = await db.select().from(technologies);
  const idBySlug = new Map(rows.map(row => [row.slug, row.id]));

  for (const project of DEMO_PROJECTS) {
    for (const slug of project.technologies) {
      const technologyId = idBySlug.get(slug);
      if (!technologyId) continue;
      await db
        .insert(projectTechnologies)
        .values({ projectId: project.id, technologyId, createdAt: DEMO_NOW })
        .onConflictDoNothing();
    }
  }
}

async function seedStats(): Promise<void> {
  for (const stats of DEMO_STATS) {
    await db.insert(projectStats).values({
      projectId: stats.projectId,
      fileCount: stats.fileCount,
      directoryCount: stats.directoryCount,
      linesOfCode: stats.linesOfCode,
      thirdPartySize: stats.thirdPartySize,
      gitBranch: stats.gitBranch,
      gitStatus: stats.gitStatus,
      gitRemoteUrl: stats.gitRemoteUrl,
      lastCommitDate: daysAgo(stats.lastCommitDaysAgo),
      lastCommitMessage: stats.lastCommitMessage,
      hasUncommittedChanges: stats.hasUncommittedChanges,
      createdAt: DEMO_NOW,
      updatedAt: DEMO_NOW,
    });

    for (const language of stats.languages) {
      await db.insert(projectLanguageStats).values({
        projectId: stats.projectId,
        technologySlug: language.technologySlug,
        fileCount: language.fileCount,
        percentage: language.percentage,
        linesOfCode: language.linesOfCode,
        createdAt: DEMO_NOW,
        updatedAt: DEMO_NOW,
      });
    }
  }
}

async function seedProcesses(): Promise<void> {
  for (const process of DEMO_PROCESSES) {
    await db.insert(projectProcesses).values({
      id: process.id,
      projectId: process.projectId,
      name: process.name,
      workingDir: process.workingDir,
      color: process.color,
      url: process.url,
      order: process.order,
      createdAt: DEMO_NOW,
      updatedAt: DEMO_NOW,
    });

    for (const [index, command] of process.commands.entries()) {
      await db.insert(projectProcessCommands).values({
        processId: process.id,
        command,
        order: index,
        createdAt: DEMO_NOW,
      });
    }
  }
}

async function seedRelatedFolders(): Promise<void> {
  const related = [
    { projectId: 'demo-proj-01', folderPath: `${DEMO_PATH_ROOT}/harbor-infra` },
    { projectId: 'demo-proj-01', folderPath: `${DEMO_PATH_ROOT}/harbor-docs` },
    { projectId: 'demo-proj-02', folderPath: `${DEMO_PATH_ROOT}/tidepool-icons` },
  ];

  for (const folder of related) {
    await db.insert(projectRelatedFolders).values({
      ...folder,
      createdAt: DEMO_NOW,
      updatedAt: DEMO_NOW,
    });
  }
}

async function seedAccounts(): Promise<void> {
  // Routed through the real service so passwords are encrypted the same way
  // user-entered credentials are.
  for (const account of DEMO_ACCOUNTS) {
    await createAccount(account);
  }
}

async function seedAliases(): Promise<void> {
  for (const alias of DEMO_ALIASES) {
    await db.insert(aliases).values({
      name: alias.name,
      command: alias.command,
      description: alias.description,
      category: alias.category,
      showCommand: alias.showCommand,
      order: alias.order,
      createdAt: DEMO_NOW,
      updatedAt: DEMO_NOW,
    });
  }
}

/**
 * Populate the demo database with deterministic fake data.
 *
 * Idempotent: existing demo rows are removed first, so running twice yields the
 * same row counts.
 */
export async function seedDemoDatabase(): Promise<void> {
  assertSafeToSeed();

  console.log('🎭 Seeding demo data...');

  await clearExistingDemoData();
  await seedProjects();
  await seedTechnologies();
  await seedStats();
  await seedProcesses();
  await seedRelatedFolders();
  await seedAccounts();
  await seedAliases();

  console.log(`✅ Demo data seeded (${DEMO_PROJECTS.length} projects)`);
}
