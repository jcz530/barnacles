import {
  Clipboard,
  FolderOpen,
  MonitorPlay,
  SquareArrowOutUpRight,
  SquareTerminal,
  Star,
} from 'lucide-vue-next';
import type { DetectedIDE, DetectedTerminal, ProjectWithDetails } from '../../../shared/types/api';
import { resolvePreferred } from '../preferences';
import type { Command, CommandContext } from '../types';

export interface ProjectCommandDeps {
  /** Installed editors and terminals, in the order they should be offered. */
  ides: DetectedIDE[];
  terminals: DetectedTerminal[];
  /** The global defaults, used when a project has no preference of its own. */
  defaultIdeId: string | null;
  defaultTerminalId: string | null;

  openInIde: (projectId: string, ideId?: string) => void | Promise<void>;
  openTerminal: (projectId: string, terminalId?: string) => void | Promise<void>;
  setPreferredIde: (projectId: string, ideId: string) => void | Promise<void>;
  setPreferredTerminal: (projectId: string, terminalId: string) => void | Promise<void>;
  revealInFinder: (projectPath: string) => void;
  copyPath: (projectPath: string) => void | Promise<void>;
}

/**
 * Per-project commands.
 *
 * One row per project, with its verbs behind that row's actions. Emitting a row
 * per verb instead put five near-identical entries in the list for every
 * project -- "Barnacles", "Open Barnacles in IDE", "Open terminal in
 * Barnacles" -- which crowded out every other kind of result and got worse with
 * each project added. The verbs stay searchable through the row's keywords, so
 * typing "barn ide" still finds it.
 *
 * Only "open the project" navigates; everything else is an HTTP call or a shell
 * IPC, so it runs identically from the floating window with no main window
 * involved. That is the point of the global hotkey -- opening an editor or a
 * terminal never has to raise the app.
 */
export const projectCommands = (
  projects: ProjectWithDetails[],
  deps: ProjectCommandDeps
): Command[] =>
  projects.map(project => {
    // Favorites surface before other projects when nothing has been typed.
    const priority = project.isFavorite ? 2 : 0;

    const preferredIde = resolvePreferred(deps.ides, project.preferredIde, deps.defaultIdeId);
    const preferredTerminal = resolvePreferred(
      deps.terminals,
      project.preferredTerminal,
      deps.defaultTerminalId
    );

    return {
      id: `project:${project.id}`,
      title: project.name,
      subtitle: project.path,
      group: 'projects' as const,
      // Enough for the palette to render the project's own icon, the same one
      // the projects page shows. The component itself is resolved at render
      // time -- a command is plain data and importing a .vue file here would
      // drag the whole renderer into the provider (and into its tests).
      projectIcon: {
        projectId: project.id,
        projectName: project.name,
        hasIcon: !!project.icon,
      },
      // The verbs are no longer rows of their own, so their words live here:
      // "barn ide" should still find this project.
      keywords: [
        project.path,
        ...project.technologies.map(tech => tech.name),
        'ide',
        'editor',
        'code',
        'terminal',
        'shell',
        'finder',
        'reveal',
        'copy path',
      ],
      priority,
      primaryActionLabel: 'Open Project',
      run: ctx => ctx.navigate(`/projects/${project.id}`),
      actions: () => projectActions(project, deps, preferredIde, preferredTerminal),
    };
  });

/** The actions offered for one project, in the order they are most wanted. */
const projectActions = (
  project: ProjectWithDetails,
  deps: ProjectCommandDeps,
  preferredIde: DetectedIDE | null,
  preferredTerminal: DetectedTerminal | null
): Command[] => [
  {
    id: `project.open:${project.id}`,
    title: 'Open Project',
    subtitle: project.path,
    group: 'projects' as const,
    icon: SquareArrowOutUpRight,
    primaryActionLabel: 'Open Project',
    run: ctx => ctx.navigate(`/projects/${project.id}`),
  },
  toolAction({
    id: `project.open-ide:${project.id}`,
    verb: 'Open in',
    fallbackTitle: 'Open in IDE',
    icon: MonitorPlay,
    preferred: preferredIde,
    installed: deps.ides,
    open: toolId => deps.openInIde(project.id, toolId),
    setDefault: toolId => deps.setPreferredIde(project.id, toolId),
    projectName: project.name,
    idPrefix: `project.open-ide:${project.id}`,
  }),
  toolAction({
    id: `project.open-terminal:${project.id}`,
    verb: 'Open in',
    fallbackTitle: 'Open Terminal',
    icon: SquareTerminal,
    preferred: preferredTerminal,
    installed: deps.terminals,
    open: toolId => deps.openTerminal(project.id, toolId),
    setDefault: toolId => deps.setPreferredTerminal(project.id, toolId),
    projectName: project.name,
    idPrefix: `project.open-terminal:${project.id}`,
  }),
  {
    id: `project.reveal:${project.id}`,
    title: 'Reveal in Finder',
    group: 'projects' as const,
    icon: FolderOpen,
    primaryActionLabel: 'Reveal',
    run: ctx => {
      deps.revealInFinder(project.path);
      ctx.dismiss();
    },
  },
  {
    id: `project.copy-path:${project.id}`,
    title: 'Copy Path',
    subtitle: project.path,
    group: 'projects' as const,
    icon: Clipboard,
    primaryActionLabel: 'Copy',
    run: async ctx => {
      await deps.copyPath(project.path);
      ctx.dismiss();
    },
  },
];

interface ToolActionSpec<T extends { id: string; name: string }> {
  id: string;
  verb: string;
  fallbackTitle: string;
  icon: Command['icon'];
  preferred: T | null;
  installed: T[];
  open: (toolId?: string) => void | Promise<void>;
  setDefault: (toolId: string) => void | Promise<void>;
  projectName: string;
  idPrefix: string;
}

/**
 * "Open in <editor>", with the others behind it.
 *
 * Carries a `run` only when a preferred tool resolved. Without one there is
 * nothing sensible to default to, so the row has actions alone and Enter opens
 * the picker instead of guessing -- the same thing the project page's split
 * button does when it has no preference to act on.
 */
const toolAction = <T extends { id: string; name: string }>(spec: ToolActionSpec<T>): Command => ({
  id: spec.id,
  title: spec.preferred ? `${spec.verb} ${spec.preferred.name}` : spec.fallbackTitle,
  group: 'projects' as const,
  icon: spec.icon,
  primaryActionLabel: spec.preferred ? `${spec.verb} ${spec.preferred.name}` : 'Choose',
  // Passing the resolved id rather than letting the backend fall back: it only
  // consults the project's own preference and throws otherwise, so a project
  // relying on the global default would fail silently.
  run: spec.preferred
    ? async ctx => {
        await spec.open(spec.preferred?.id);
        ctx.dismiss();
      }
    : undefined,
  actions: () => toolPickerActions(spec),
});

/**
 * The tools to choose from, then the same list again as defaults to set.
 *
 * Picking deliberately opens without changing anything: reaching for a
 * different editor once is far more common than wanting to switch for good, and
 * silently rebinding a preference because of one use is the kind of thing that
 * makes a palette untrustworthy. Setting a default is its own action, in its
 * own group so it reads as a separate block.
 */
const toolPickerActions = <T extends { id: string; name: string }>(
  spec: ToolActionSpec<T>
): Command[] => [
  ...spec.installed.map(tool => ({
    id: `${spec.idPrefix}.pick:${tool.id}`,
    title: tool.name,
    group: 'projects' as const,
    icon: spec.icon,
    primaryActionLabel: `${spec.verb} ${tool.name}`,
    run: async (ctx: CommandContext) => {
      await spec.open(tool.id);
      ctx.dismiss();
    },
  })),
  ...spec.installed.map(tool => ({
    id: `${spec.idPrefix}.set-default:${tool.id}`,
    title: `Always use ${tool.name} for ${spec.projectName}`,
    group: 'app' as const,
    icon: Star,
    primaryActionLabel: 'Set Default',
    run: async (ctx: CommandContext) => {
      await spec.setDefault(tool.id);
      // Back to the list rather than closing: setting a default is usually a
      // step before doing the thing, not the thing itself.
      ctx.pop?.();
    },
  })),
];
