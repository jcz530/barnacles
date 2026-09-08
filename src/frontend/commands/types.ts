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
}

export interface Command {
  /** Stable and namespaced: 'nav.ports', `project.open-ide:${id}`. */
  id: string;
  title: string;
  /** Secondary line -- a project path, a port's process name. */
  subtitle?: string;
  group: CommandGroupId;
  icon?: Component;
  /** Extra fuzzy-match terms that aren't in the title or subtitle. */
  keywords?: string[];
  /**
   * Ranks a command up among equally-fuzzy matches. Favorites and running
   * processes use this so they surface before inert entries.
   */
  priority?: number;
  run: (ctx: CommandContext) => void | Promise<void>;
}
