import { Keyboard, MoonStar, RefreshCw, SquarePlus, Sun } from 'lucide-vue-next';
import { SETTING_KEYS } from '../../../shared/types/api';
import type { Command, CommandContext } from '../types';

export interface AppCommandDeps {
  rescanAll: () => void | Promise<void>;
  toggleTheme: () => void;
  isDark: () => boolean;
  newWindow: () => void | Promise<void>;
  /**
   * Whether the global shortcut is already on. It ships off, and the row that
   * offers to set it up is only worth showing to someone who has not.
   */
  globalShortcutEnabled: boolean;
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
  // Only for people who have not set it up. Reaching this row means the palette
  // is already open and being used, which is the moment its "from anywhere"
  // half is worth explaining -- and the one place the setting can be offered
  // without the circularity of needing the global shortcut to find it.
  ...(deps.globalShortcutEnabled
    ? []
    : [
        {
          id: 'app.enable-global-shortcut',
          title: 'Open the palette from anywhere',
          subtitle: 'Set up a global shortcut',
          group: 'app' as const,
          icon: Keyboard,
          keywords: ['global', 'shortcut', 'hotkey', 'anywhere', 'background', 'keybinding'],
          priority: 1,
          primaryActionLabel: 'Set Up',
          // Settings rather than a toggle here: the combo has to be chosen and
          // the registration can fail against whatever already owns it, and
          // neither a picker nor that error has anywhere to live in a palette
          // row that dismisses itself.
          //
          // Deep-linked to the setting itself, which the page scrolls to and
          // highlights -- landing at the top of a long page and hunting for the
          // row is most of the friction this shortcut exists to remove.
          run: (ctx: CommandContext) =>
            ctx.navigate(`/settings?setting=${SETTING_KEYS.COMMAND_PALETTE_SHORTCUT}`),
        },
      ]),
  {
    id: 'app.new-window',
    title: 'New window',
    primaryActionLabel: 'New Window',
    group: 'app',
    icon: SquarePlus,
    keywords: ['open', 'another'],
    priority: 1,
    // The File menu registers this, so the palette can point at the faster way
    // rather than being the only way.
    accelerator: 'CommandOrControl+N',
    run: async ctx => {
      await deps.newWindow();
      ctx.dismiss();
    },
  },
];
