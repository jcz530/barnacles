import type { Component } from 'vue';

export type CommandGroupId =
  'navigation' | 'projects' | 'processes' | 'ports' | 'utilities' | 'app';

/**
 * Display order for groups that tie on relevance.
 */
export const COMMAND_GROUP_LABELS: Record<CommandGroupId, string> = {
  projects: 'Projects',
  processes: 'Processes',
  ports: 'Ports',
  navigation: 'Go to',
  utilities: 'Utilities',
  app: 'Application',
};

/**
 * Which palette a command is running in.
 *
 * 'floating' is the standalone always-on-top window opened by the global
 * hotkey. It has no router of its own, so navigation there has to be handed off
 * to a main window -- see CommandContext.navigate.
 */
export type CommandSurface = 'in-app' | 'floating';

export interface CommandContext {
  surface: CommandSurface;
  /**
   * Go to a route. In-app this is a router push; from the floating window it
   * focuses (or creates) a main window and asks it to navigate.
   */
  navigate: (path: string) => void | Promise<void>;
  /** Close the palette. */
  dismiss: () => void;
  /**
   * Go back one level without closing the palette. Used by actions that finish
   * in place -- setting a default, say -- where dismissing would throw away the
   * list the person was working through.
   *
   * A no-op at the root rather than absent: a root-level command that means to
   * stay open -- toggling the theme -- would otherwise have no way to say so,
   * and `pop?.()` there would silently fall through to nothing while reading
   * like it had done something.
   */
  pop: () => void;
  /**
   * Say what just happened, in the palette itself.
   *
   * Deliberately not a toast. The floating palette is hidden a frame after
   * `dismiss()`, so a toast raised there is painted into a window nobody sees;
   * in-app one lands in a corner just as the palette it belongs to vanishes.
   * This renders inside the palette, which is the surface being looked at in
   * both cases.
   *
   * Commands that report something should generally not dismiss -- the message
   * needs somewhere to live. See the stay-open commands in ports/processes.
   */
  status: (message: string, kind?: CommandStatusKind) => void;
}

/** Whether a status message reports success or failure. */
export type CommandStatusKind = 'success' | 'error';

/**
 * A message shown in the palette, with the identity needed to re-announce a
 * repeat.
 *
 * Copying the same path twice produces identical text, and without something
 * changing, neither the DOM nor a screen reader registers the second one. The
 * id makes each report distinct.
 */
export interface CommandStatus {
  id: number;
  message: string;
  kind: CommandStatusKind;
}

export interface PaletteItem {
  /** Stable and namespaced: 'nav.ports', `project.open-ide:${id}`. */
  id: string;
  title: string;
  /** Secondary line -- a project path, a port's process name. */
  subtitle?: string;
  group: CommandGroupId;
  /**
   * Override the group's heading, and split these rows into a section of their
   * own under it.
   *
   * For groups a fixed CommandGroupId cannot name: "NPM Scripts" versus
   * "Composer Scripts" versus "api/package.json Scripts" are all processes, but
   * a flat list of forty scripts is unreadable without the manifest they came
   * from. Rows sharing a group and a label group together.
   */
  groupLabel?: string;
  icon?: Component;
  /**
   * Render the project's own icon instead of `icon`, matching what the projects
   * page shows. Described as data rather than a component so providers stay
   * free of .vue imports; the palette resolves it at render time.
   */
  projectIcon?: {
    projectId: string;
    projectName: string;
    hasIcon: boolean;
  };
  /** Extra fuzzy-match terms that aren't in the title or subtitle. */
  keywords?: string[];
  /**
   * Ranks a command up among equally-fuzzy matches. Favorites and running
   * processes use this so they surface before inert entries.
   */
  priority?: number;
  /**
   * What Enter does.
   *
   * Optional: an item with actions but no `run` has no single obvious verb, so
   * Enter opens its actions instead of guessing. That is how "open in IDE"
   * behaves when no preferred IDE is set -- there is nothing to default to, so
   * the choice is the action.
   */
  run?: (ctx: CommandContext) => void | Promise<void>;
  /**
   * The item's own actions, shown as a nested level.
   *
   * A function rather than an array because the registry rebuilds every item
   * whenever projects or ports change, and materializing each item's actions
   * eagerly would rebuild a list nobody has opened. Called when the level is
   * pushed, so it also closes over the freshest data.
   */
  actions?: (ctx: CommandContext) => PaletteItem[];
  /**
   * Fetch whatever this item's level needs, called as the level is pushed.
   *
   * Deliberately not an async `actions`. `actions` has to stay synchronous:
   * useLevelStack rebuilds every open level by calling it on each root refresh
   * and cannot await, so an async variant would be dropped there within a poll
   * cycle. Pushing has to stay synchronous too -- depth is reported to the main
   * process on the same tick, and Escape is decided from it there, so a
   * deferred push would close the whole window instead of backing out a level.
   *
   * So this only starts the fetch. The result lands in the registry's own
   * state, the root list recomputes, and the rebuild watcher runs `actions`
   * again -- which is how the loaded rows arrive. The refresh that would have
   * destroyed an async level is what fills this one in.
   */
  prepare?: () => void;
  /**
   * Put the subtitle under the title rather than opposite it.
   *
   * For rows whose subtitle is content rather than a hint -- a script's body
   * runs to hundreds of characters, and set beside the name there is nothing
   * left of the name.
   */
  stackSubtitle?: boolean;
  /**
   * A placeholder standing in for rows that are still arriving. Carries no verb
   * and is not selectable; it exists so a group that is filling in has shape
   * rather than appearing out of nowhere.
   */
  loading?: boolean;
  /**
   * Names the Enter action in the footer -- "Open Project", "Kill Port".
   * Falls back to a generic label when unset.
   */
  primaryActionLabel?: string;
  /**
   * Electron-style accelerator ('CommandOrControl+Return') for the hint shown
   * beside this item. Display only; the palette does not bind it.
   */
  accelerator?: string;
}

/**
 * The palette's item type was called Command when every row was a verb. Rows
 * are now mostly nouns that carry verbs, but the alias keeps existing providers
 * and tests compiling.
 */
export type Command = PaletteItem;
