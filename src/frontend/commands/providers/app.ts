import { MoonStar, RefreshCw, SquarePlus, Sun } from 'lucide-vue-next';
import type { Command } from '../types';

export interface AppCommandDeps {
  rescanAll: () => void | Promise<void>;
  toggleTheme: () => void;
  isDark: () => boolean;
  newWindow: () => void | Promise<void>;
}

/**
 * Application-level commands that aren't tied to a specific project or port.
 *
 * Adding a single project by path deliberately isn't here. Projects are meant
 * to be found by scanning the directories that hold them, which is what "Scan
 * for projects" does; picking one folder at a time is an MCP affordance, for an
 * agent that already knows the path, rather than a way people are expected to
 * work.
 */
export const appCommands = (deps: AppCommandDeps): Command[] => [
  {
    id: 'app.rescan',
    title: 'Scan for projects',
    primaryActionLabel: 'Scan',
    subtitle: 'Search your configured directories',
    group: 'app',
    icon: RefreshCw,
    keywords: ['refresh', 'discover', 'find'],
    priority: 1,
    run: async ctx => {
      await deps.rescanAll();
      ctx.dismiss();
    },
  },
  {
    id: 'app.toggle-theme',
    title: deps.isDark() ? 'Switch to light mode' : 'Switch to dark mode',
    primaryActionLabel: 'Switch Theme',
    group: 'app',
    icon: deps.isDark() ? Sun : MoonStar,
    keywords: ['theme', 'dark', 'light', 'appearance'],
    priority: 1,
    run: ctx => {
      deps.toggleTheme();
      ctx.dismiss();
    },
  },
  {
    id: 'app.new-window',
    title: 'New window',
    primaryActionLabel: 'New Window',
    group: 'app',
    icon: SquarePlus,
    keywords: ['open', 'another'],
    priority: 1,
    run: async ctx => {
      await deps.newWindow();
      ctx.dismiss();
    },
  },
];
