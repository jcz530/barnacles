import { eq } from 'drizzle-orm';
import { db } from '../../../shared/database';
import {
  projectProcessCommands,
  projectProcesses,
  projects,
} from '../../../shared/database/schema';
import type { StartProcess } from '../../../shared/types/process';
import { createId } from '@paralleldrive/cuid2';

class ProjectProcessService {
  /**
   * Get the start processes configuration for a project
   */
  async getStartProcesses(projectId: string): Promise<StartProcess[]> {
    const processes = await db
      .select()
      .from(projectProcesses)
      .where(eq(projectProcesses.projectId, projectId))
      .orderBy(projectProcesses.order);

    const result: StartProcess[] = [];

    for (const process of processes) {
      const commands = await db
        .select()
        .from(projectProcessCommands)
        .where(eq(projectProcessCommands.processId, process.id))
        .orderBy(projectProcessCommands.order);

      result.push({
        id: process.id,
        name: process.name,
        commands: commands.map(c => c.command),
        workingDir: process.workingDir ?? undefined,
        color: process.color ?? undefined,
        url: process.url ?? undefined,
      });
    }

    return result;
  }

  /**
   * Update the start processes configuration for a project
   */
  async updateStartProcesses(projectId: string, startProcessesData: StartProcess[]): Promise<void> {
    // Delete existing processes and commands (cascade will handle commands)
    await db.delete(projectProcesses).where(eq(projectProcesses.projectId, projectId));

    // Insert new processes and commands
    for (let i = 0; i < startProcessesData.length; i++) {
      const process = startProcessesData[i];

      // Insert process
      await db.insert(projectProcesses).values({
        id: process.id,
        projectId: projectId,
        name: process.name,
        workingDir: process.workingDir ?? null,
        color: process.color ?? null,
        url: process.url ?? null,
        order: i,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Insert commands
      for (let j = 0; j < process.commands.length; j++) {
        await db.insert(projectProcessCommands).values({
          id: createId(),
          processId: process.id,
          command: process.commands[j],
          order: j,
          createdAt: new Date(),
        });
      }
    }

    // Update project's updatedAt timestamp
    await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId));
  }
}

export const projectProcessService = new ProjectProcessService();
