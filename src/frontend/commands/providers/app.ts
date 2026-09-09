import { FolderPlus, MoonStar, RefreshCw, SquarePlus, Sun } from 'lucide-vue-next';
import type { Command } from '../types';

export interface AppCommandDeps {
  addProject: () => void | Promise<void>;
  rescanAll: () => void | Promise<void>;
  toggleTheme: () => void;
  isDark: () => boolean;
  newWindow: () => void | Promise<void>;
}

/**
 * Application-level commands that aren't tied to a specific project or port.
 */
export const appCommands = (deps: AppCommandDeps): Command[] => [
  {
    id: 'app.add-project',
    title: 'Add project',
    primaryActionLabel: 'Add Project',
    subtitle: 'Pick a folder to track',
    group: 'app',
    icon: FolderPlus,
    keywords: ['new', 'import', 'track', 'folder'],
    priority: 1,
    run: async ctx => {
      await deps.addProject();
      ctx.dismiss();
    },
  },
  {
    id: 'app.rescan',
    title: 'Scan for projects',
    primaryActionLabel: 'Scan',
    subtitle: 'Search your configured directories',
    group: 'app',
    icon: RefreshCw,
    keywords: ['refresh', 'discover', 'find'],
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
    run: async ctx => {
      await deps.newWindow();
      ctx.dismiss();
    },
  },
];
