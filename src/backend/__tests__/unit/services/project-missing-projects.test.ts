import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createUnitTestContext, mockDatabaseForUnit } from '@test/contexts';
import { ProjectRescanSchedulerService } from '@backend/services/project-rescan-scheduler-service';
import { projectService } from '@backend/services/project';
import { db } from '@shared/database';
import { projects, projectProcesses } from '@shared/database/schema';
import { eq } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

mockDatabaseForUnit();

/**
 * A rescan cannot tell a deleted folder from an unmounted drive, so a project
 * whose directory disappears is flagged rather than deleted -- deleting would
 * cascade away the processes, accounts and exclusions the user configured.
 */
describe('missing projects', () => {
  const context = createUnitTestContext();
  let tempDir: string;
  let scheduler: ProjectRescanSchedulerService;

  beforeEach(async () => {
    await context.setup();
    tempDir = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'missing-test-')));
    scheduler = new ProjectRescanSchedulerService();
    // rescanAllProjects() no-ops unless the scheduler is running.
    await scheduler.start();
  });

  afterEach(async () => {
    scheduler.stop();
    await context.teardown();
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  /** Creates a directory isValidProject() accepts, plus its project row. */
  async function seedProject(id: string, name: string): Promise<string> {
    const dir = path.join(tempDir, name);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify({ name }));
    await db.insert(projects).values({ id, name, path: dir });
    return dir;
  }

  it('flags a project whose directory has been removed', async () => {
    const dir = await seedProject('gone', 'gone-project');
    await fs.rm(dir, { recursive: true, force: true });

    await scheduler.triggerManualRescan();

    const [row] = await db.select().from(projects).where(eq(projects.id, 'gone'));
    expect(row.missingSince).toBeInstanceOf(Date);
  });

  it('keeps the project row and its configured data', async () => {
    const dir = await seedProject('keep', 'keep-project');
    await db.insert(projectProcesses).values({
      id: 'proc-1',
      projectId: 'keep',
      name: 'dev server',
      order: 0,
    });
    await fs.rm(dir, { recursive: true, force: true });

    await scheduler.triggerManualRescan();

    expect(await db.select().from(projects).where(eq(projects.id, 'keep'))).toHaveLength(1);
    const procs = await db
      .select()
      .from(projectProcesses)
      .where(eq(projectProcesses.projectId, 'keep'));
    expect(procs).toHaveLength(1);
  });

  it('does not flag a project that is still present', async () => {
    await seedProject('here', 'here-project');

    await scheduler.triggerManualRescan();

    const [row] = await db.select().from(projects).where(eq(projects.id, 'here'));
    expect(row.missingSince).toBeNull();
  });

  it('clears the flag when the directory comes back', async () => {
    const dir = await seedProject('returns', 'returning-project');
    await fs.rm(dir, { recursive: true, force: true });
    await scheduler.triggerManualRescan();

    // The "unmounted drive" case: the directory reappears unchanged.
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'package.json'), '{}');
    await scheduler.triggerManualRescan();

    const [row] = await db.select().from(projects).where(eq(projects.id, 'returns'));
    expect(row.missingSince).toBeNull();
  });

  it('keeps the original timestamp across repeated rescans', async () => {
    const dir = await seedProject('stable', 'stable-project');
    await fs.rm(dir, { recursive: true, force: true });

    await scheduler.triggerManualRescan();
    const [first] = await db.select().from(projects).where(eq(projects.id, 'stable'));
    await scheduler.triggerManualRescan();
    const [second] = await db.select().from(projects).where(eq(projects.id, 'stable'));

    expect(second.missingSince).toEqual(first.missingSince);
  });

  it('excludes missing projects from the default listing', async () => {
    const dir = await seedProject('hidden', 'hidden-project');
    await seedProject('visible', 'visible-project');
    await fs.rm(dir, { recursive: true, force: true });
    await scheduler.triggerManualRescan();

    const listed = await projectService.getProjects();
    const withMissing = await projectService.getProjects({ includeMissing: true });

    expect(listed.map(p => p.id)).toEqual(['visible']);
    expect(withMissing.map(p => p.id).sort()).toEqual(['hidden', 'visible']);
  });

  it('stops resolving a missing project by path', async () => {
    const dir = await seedProject('bypath', 'bypath-project');
    expect(await projectService.getProjectByPath(dir)).not.toBeNull();

    await fs.rm(dir, { recursive: true, force: true });
    await scheduler.triggerManualRescan();

    expect(await projectService.getProjectByPath(dir)).toBeNull();
  });
});
