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
   * Absent at the root, where there is nothing to go back to.
   */
  pop?: () => void;
}

export interface PaletteItem {
  /** Stable and namespaced: 'nav.ports', `project.open-ide:${id}`. */
  id: string;
  title: string;
  /** Secondary line -- a project path, a port's process name. */
  subtitle?: string;
  group: CommandGroupId;
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
