import { Clipboard, FolderOpen, MonitorPlay, SquareTerminal } from 'lucide-vue-next';
import type { ProjectWithDetails } from '../../../shared/types/api';
import type { Command } from '../types';

export interface ProjectCommandDeps {
  openInIde: (projectId: string) => void | Promise<void>;
  openTerminal: (projectId: string) => void | Promise<void>;
  revealInFinder: (projectPath: string) => void;
  copyPath: (projectPath: string) => void | Promise<void>;
}

/**
 * Per-project commands.
 *
 * Only "Open <project>" navigates; everything else is an HTTP call or a shell
 * IPC, so it runs identically from the floating window with no main window
 * involved. That is the point of the global hotkey -- opening an editor or a
 * terminal never has to raise the app.
 *
 * Project tabs deliberately aren't enumerated here. Six entries per project
 * makes the list unreadable at any real project count; a drill-down mode is the
 * better home for those.
 */
export const projectCommands = (
  projects: ProjectWithDetails[],
  deps: ProjectCommandDeps
): Command[] =>
  projects.flatMap(project => {
    // Favorites surface before other projects when nothing has been typed.
    const priority = project.isFavorite ? 2 : 0;
    const keywords = [project.path, ...project.technologies.map(tech => tech.name)];

    // Enough for the palette to render the project's own icon, the same one the
    // projects page shows. The component itself is resolved at render time --
    // a command is plain data and importing a .vue file here would drag the
    // whole renderer into the provider (and into its tests).
    const projectIcon = {
      projectIcon: {
        projectId: project.id,
        projectName: project.name,
        hasIcon: !!project.icon,
      },
    };

    return [
      {
        id: `project.open:${project.id}`,
        title: project.name,
        subtitle: project.path,
        group: 'projects' as const,
        ...projectIcon,
        keywords,
        priority,
        run: ctx => ctx.navigate(`/projects/${project.id}`),
      },
      {
        id: `project.open-ide:${project.id}`,
        title: `Open ${project.name} in IDE`,
        subtitle: project.path,
        group: 'projects' as const,
        icon: MonitorPlay,
        keywords: [...keywords, 'editor', 'code', 'vscode'],
        run: async ctx => {
          await deps.openInIde(project.id);
          ctx.dismiss();
        },
      },
      {
        id: `project.open-terminal:${project.id}`,
        title: `Open terminal in ${project.name}`,
        subtitle: project.path,
        group: 'projects' as const,
        icon: SquareTerminal,
        keywords: [...keywords, 'shell', 'console'],
        run: async ctx => {
          await deps.openTerminal(project.id);
          ctx.dismiss();
        },
      },
      {
        id: `project.reveal:${project.id}`,
        title: `Reveal ${project.name} in Finder`,
        subtitle: project.path,
        group: 'projects' as const,
        icon: FolderOpen,
        keywords: [...keywords, 'files', 'explorer', 'folder'],
        run: ctx => {
          deps.revealInFinder(project.path);
          ctx.dismiss();
        },
      },
      {
        id: `project.copy-path:${project.id}`,
        title: `Copy path to ${project.name}`,
        subtitle: project.path,
        group: 'projects' as const,
        icon: Clipboard,
        keywords: [...keywords, 'clipboard'],
        run: async ctx => {
          await deps.copyPath(project.path);
          ctx.dismiss();
        },
      },
    ];
  });
