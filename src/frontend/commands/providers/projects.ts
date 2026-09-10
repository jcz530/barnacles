import {
  Copy,
  ExternalLink,
  FolderGit2,
  FolderOpen,
  MonitorPlay,
  SquareTerminal,
  Star,
  StarOff,
} from 'lucide-vue-next';
import type { DetectedIDE, DetectedTerminal, ProjectWithDetails } from '../../../shared/types/api';
import type { ProjectProcessStatus } from '../../../shared/types/process';
import {
  projectProcessActions,
  type ProcessCommandDeps,
  type ProcessCommandState,
} from './processes';
import { scriptCommands, type ScriptCommandDeps, type ScriptCommandState } from './scripts';
import { resolvePreferred } from '../preferences';
import { truncateValue } from '../useCommandStatus';
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
  /**
   * Flip a project's favourite state, resolving to what it now is.
   *
   * The new state comes back rather than being inferred from the old one: the
   * endpoint is a blind flip and the palette stays open afterwards, so the row
   * that was pressed may be a rebuild behind by the time the next press lands.
   */
  toggleFavorite: (projectId: string) => Promise<boolean>;
  /**
   * Name and web URL for a remote, or null when there is no remote or it
   * cannot be read as one. Shared with the projects page's dropdown so the two
   * name a provider the same way.
   */
  gitProvider: (remoteUrl: string | null | undefined) => { name: string; webUrl: string } | null;
  openExternal: (url: string) => void | Promise<void>;
  /**
   * The project whose page is open, if one is.
   *
   * Ranked to the top so the palette opens with the thing already on screen
   * within reach. Deliberately only a ranking: Cmd+K still lands at the root
   * with an empty box, which is the one thing about the palette worth being
   * able to rely on without looking.
   *
   * Null in the floating window, which has no router to ask.
   */
  currentProjectId?: string | null;

  /** What is running, and what each project has configured to run. */
  processStatuses: ProjectProcessStatus[];
  processState: ProcessCommandState;
  processDeps: ProcessCommandDeps;
  /** The project's runnable scripts, and how to run one. */
  scriptState: ScriptCommandState;
  scriptDeps: ScriptCommandDeps;
  /**
   * Start fetching a project's configured processes and its scripts. Called as
   * the project's level opens, since that is the only place either is shown.
   */
  loadProcesses: (projectId: string) => void;
  loadScripts: (projectId: string) => void;
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
    // The project being looked at outranks favorites, which outrank the rest,
    // when nothing has been typed.
    const isCurrent = !!deps.currentProjectId && project.id === deps.currentProjectId;
    const priority = isCurrent ? 3 : project.isFavorite ? 2 : 0;

    const preferredIde = resolvePreferred(deps.ides, project.preferredIde, deps.defaultIdeId);
    const preferredTerminal = resolvePreferred(
      deps.terminals,
      project.preferredTerminal,
      deps.defaultTerminalId
    );

    return {
      id: `project:${project.id}`,
      title: project.name,
      // The path stays, rather than being swapped for "Currently viewing":
      // two worktrees of one repo share a name, and the path is what tells
      // them apart. Being first in the list is the signal; a label repeating
      // what the page behind it already says would be noise.
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
        'favorite',
        'star',
        // So "alchemy github" finds the project whose remote is on GitHub, the
        // way "alchemy ide" finds it by a verb it carries.
        deps.gitProvider(project.stats?.gitRemoteUrl)?.name.toLowerCase() ?? '',
        'remote',
      ].filter(Boolean),
      priority,
      primaryActionLabel: 'Open Project',
      run: ctx => ctx.navigate(`/projects/${project.id}`),
      // The processes shown in this project's level are the only thing here
      // that has to be fetched, and only this project's are needed -- so they
      // are asked for as the level opens rather than for every project up front.
      prepare: () => {
        deps.loadProcesses(project.id);
        deps.loadScripts(project.id);
      },
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
    // The glyph the sidebar gives Projects, so the row reads as "the project"
    // rather than as a generic "open something elsewhere" arrow.
    icon: FolderGit2,
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
    toolNoun: 'editors',
    keywords: ['ide', 'editor', 'code'],
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
    toolNoun: 'terminals',
    keywords: ['terminal', 'shell', 'console'],
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
  // Only when there is a remote to open. A row that cannot do its verb is
  // worse than an absent one in a list this short.
  ...remoteAction(project, deps),
  {
    id: `project.favorite:${project.id}`,
    title: project.isFavorite ? 'Remove from Favorites' : 'Add to Favorites',
    group: 'projects' as const,
    icon: project.isFavorite ? StarOff : Star,
    primaryActionLabel: project.isFavorite ? 'Remove' : 'Add',
    keywords: ['favourite', 'star', 'unstar', 'pin', 'bookmark'],
    // Stays open, like the other verbs that finish in place. The row itself
    // reports the result -- it flips to the opposite verb as the projects query
    // refetches -- so closing would hide the confirmation.
    run: async (ctx: CommandContext) => {
      try {
        // Reported from what came back, not from the isFavorite captured when
        // this row was built. Pressing Enter twice in quick succession runs the
        // same closure both times -- the rebuild needs a refetch to land -- so
        // the captured value would announce "Added" for the press that removed
        // it again.
        const isFavorite = await deps.toggleFavorite(project.id);
        ctx.status(
          isFavorite
            ? `Added ${project.name} to favorites`
            : `Removed ${project.name} from favorites`
        );
      } catch {
        ctx.status('Could not update favorites', 'error');
      }
    },
  },
  {
    id: `project.copy-path:${project.id}`,
    title: 'Copy Path',
    subtitle: project.path,
    group: 'projects' as const,
    // The same glyph the projects page's dropdown gives this action.
    icon: Copy,
    primaryActionLabel: 'Copy',
    // Stays open -- see the port copy actions. Nothing changes on screen, so
    // the message is the only evidence the copy happened.
    run: async ctx => {
      try {
        await deps.copyPath(project.path);
        ctx.status(`Copied ${truncateValue(project.path)}`);
      } catch {
        ctx.status('Could not copy the path', 'error');
      }
    },
  },
  // Appended, so the level always opens with the project's own verbs on screen
  // and the processes fill in beneath them once they arrive.
  ...projectProcessActions(project, deps.processStatuses, deps.processState, deps.processDeps),
  ...scriptCommands(project, deps.scriptState, deps.scriptDeps),
];

/**
 * "View on GitHub", or whatever the remote turns out to be.
 *
 * Named for the provider rather than "View Remote": the projects page's
 * dropdown already says "View on GitHub", and the palette naming the same
 * thing differently would read as a different action.
 *
 * Returns nothing at all for a project with no remote -- a local-only repo, or
 * one whose stats have not been gathered yet.
 */
const remoteAction = (project: ProjectWithDetails, deps: ProjectCommandDeps): Command[] => {
  const remoteUrl = project.stats?.gitRemoteUrl;
  const provider = deps.gitProvider(remoteUrl);

  if (!provider) return [];

  // "Other" is what the shared resolver returns for a domain it does not
  // recognise -- a self-hosted GitLab, say. "View on Other" is not a sentence,
  // so those get the generic wording and are still found by "remote".
  const named = provider.name !== 'Other';

  return [
    {
      id: `project.remote:${project.id}`,
      title: named ? `View on ${provider.name}` : 'View Remote',
      subtitle: provider.webUrl,
      group: 'projects' as const,
      // The same glyph the projects page's dropdown gives this action.
      icon: ExternalLink,
      primaryActionLabel: named ? `Open ${provider.name}` : 'Open Remote',
      // The provider's own name is what people reach for -- "alchemy github"
      // should find this -- alongside the words for the thing in general.
      keywords: [provider.name.toLowerCase(), 'remote', 'origin', 'repository', 'repo', 'git'],
      run: async ctx => {
        await deps.openExternal(provider.webUrl);
        ctx.dismiss();
      },
    },
  ];
};

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
  /** Plural, for the "none detected" subtitle: "editors", "terminals". */
  toolNoun: string;
  /**
   * Words for the kind of tool, since the title stops containing them.
   *
   * Once a preferred tool resolves, this row reads "Open in VS Code" -- so
   * "ide", the word someone reaches for when they cannot remember which editor
   * a project is set to, matches nothing at all.
   */
  keywords: string[];
}

/**
 * "Open in <editor>", with the others behind it.
 *
 * Carries a `run` only when a preferred tool resolved. Without one there is
 * nothing sensible to default to, so the row has actions alone and Enter opens
 * the picker instead of guessing -- the same thing the project page's split
 * button does when it has no preference to act on.
 */
const toolAction = <T extends { id: string; name: string }>(spec: ToolActionSpec<T>): Command => {
  // Nothing detected at all. Offer the way to fix that rather than a row whose
  // list would be empty -- an empty level is a dead end you have to back out
  // of, and pushing one is refused, so the row would simply not respond.
  if (spec.installed.length === 0) {
    return {
      id: spec.id,
      title: spec.fallbackTitle,
      subtitle: `No ${spec.toolNoun} detected`,
      group: 'projects' as const,
      icon: spec.icon,
      keywords: spec.keywords,
      primaryActionLabel: 'Open Settings',
      run: ctx => ctx.navigate('/settings'),
    };
  }

  return {
    id: spec.id,
    title: spec.preferred ? `${spec.verb} ${spec.preferred.name}` : spec.fallbackTitle,
    group: 'projects' as const,
    icon: spec.icon,
    // The kind of tool, plus the one that resolved: "ide" finds this row even
    // when it reads "Open in VS Code", and so does "vs code".
    keywords: [...spec.keywords, spec.preferred?.name.toLowerCase() ?? ''].filter(Boolean),
    primaryActionLabel: spec.preferred ? `${spec.verb} ${spec.preferred.name}` : 'Choose',
    // Passing the resolved id rather than letting the backend fall back: it
    // only consults the project's own preference and throws otherwise, so a
    // project relying on the global default would fail silently.
    run: spec.preferred
      ? async ctx => {
          await spec.open(spec.preferred?.id);
          ctx.dismiss();
        }
      : undefined,
    actions: () => toolPickerActions(spec),
  };
};

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
      // Named rather than "Default updated": the row that was just pressed
      // said "Always use X", and echoing the choice is what confirms the right
      // one was pressed.
      ctx.status(`${tool.name} is now the default for ${spec.projectName}`);
      // Back to the list rather than closing: setting a default is usually a
      // step before doing the thing, not the thing itself.
      ctx.pop();
    },
  })),
];
