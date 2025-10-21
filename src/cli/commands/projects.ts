import { autocomplete, log } from '@clack/prompts';
import pc from '../utils/colors';
import { Command } from '../core/Command.js';
import type { ProjectWithDetails } from '../../backend/services/project-service.js';
import { projectService } from '../../backend/services/project-service.js';
import { formatTimeAgo } from '../utils/format-time.js';

/**
 * Command to list and select projects
 */
export class ProjectsCommand extends Command {
  readonly name = 'projects';
  readonly description = 'Browse and select projects';
  readonly aliases = ['p'];
  readonly showIntro = true;

  async execute(_flags: Record<string, string | boolean>): Promise<void> {
    try {
      // Fetch projects from the service
      log.step('Loading projects...');
      const projects = await projectService.getProjects();

      if (!projects || projects.length === 0) {
        log.warn('No projects found. Run a scan in the Barnacles app to add projects.');
        return;
      }

      // Show autocomplete with projects
      const selectedProject = await autocomplete({
        message: 'Select a project:',
        options: projects.map((project: ProjectWithDetails) => ({
          value: project.id,
          label: project.name,
          hint: project.path,
        })),
      });

      // Find the selected project
      const project = projects.find((p: ProjectWithDetails) => p.id === selectedProject);

      if (!project) {
        log.error('Project not found');
        return;
      }

      // Display project information
      log.success(`Selected: ${project.name}`);
      log.info(`Path: ${project.path}`);
      log.message(
        `Last Modified: ${project.lastModified.toLocaleString()} ${pc.dim(formatTimeAgo(project.lastModified))}`
      );

      if (project.description) {
        log.message(`Description: ${project.description}`);
      }

      if (project.technologies && project.technologies.length > 0) {
        const techList = project.technologies.map(t => t.name).join(', ');
        log.message(`Technologies: ${techList}`);
      }

      if (project.stats) {
        const stats = project.stats;
        if (stats.fileCount) {
          log.message(`Files: ${stats.fileCount.toLocaleString()}`);
        }
        if (stats.gitBranch) {
          log.message(`Git Branch: ${stats.gitBranch}`);
        }
      }
    } catch (error) {
      log.error('Failed to fetch projects from database.');
      console.error(error);
      process.exit(1);
    }
  }
}
