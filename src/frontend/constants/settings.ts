import {
  FolderSearch,
  AppWindow,
  Palette,
  Keyboard,
  GitBranch,
  Wrench,
  type LucideIcon,
} from 'lucide-vue-next';
import { SETTING_KEYS, type SettingKey } from '../../shared/types/api';

/**
 * One setting, as data.
 *
 * The label and description duplicate what the setting's own organism renders.
 * That duplication is deliberate and is what makes search possible: the sidebar
 * and the search index need to know a setting's name without mounting it, and
 * a component's template is not readable from outside.
 */
export interface SettingDef {
  key: SettingKey;
  label: string;
  description: string;
  /** Extra fuzzy-search terms. Not shown anywhere. Mirrors `NavItem.keywords`. */
  keywords?: string[];
}

/**
 * A settings section: one sidebar entry, one heading on the page.
 */
export interface SettingsSectionDef {
  /** Anchor id on the page and the scroll-spy key. Kebab-case. */
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  settings: SettingDef[];
}

/**
 * Every settings section, in render order.
 *
 * This is the single source for three surfaces that used to disagree: the
 * sidebar's headings, the search index, and the order sections render in on the
 * page. Adding a setting here and adding it to `SETTING_COMPONENTS` in
 * `views/Settings.vue` is the whole job -- there is no third place to edit.
 *
 * Two keys in `SETTING_KEYS` are deliberately absent, because neither has a
 * setting of its own to navigate to: COMMAND_PALETTE_SHORTCUT_ENABLED is a
 * toggle inside CommandPaletteShortcutSetting, and MCP_USAGE_RETENTION_DAYS is
 * a dropdown inside McpUsageLoggingSetting. `constants/settings.test.ts` pins
 * that list so a genuinely new key cannot be added without being placed here.
 */
export const SETTINGS_SECTIONS: SettingsSectionDef[] = [
  {
    id: 'project-scanning',
    title: 'Project Scanning',
    description: 'Configure how projects are discovered and scanned',
    icon: FolderSearch,
    settings: [
      {
        key: SETTING_KEYS.SCAN_INCLUDED_DIRECTORIES,
        label: 'Scan Directories',
        description: 'Base directories to scan for projects.',
        keywords: ['folders', 'paths', 'include', 'search', 'discover'],
      },
      {
        key: SETTING_KEYS.SCAN_MAX_DEPTH,
        label: 'Scan Maximum Depth',
        description: 'Maximum directory depth to scan when searching for projects.',
        keywords: ['nested', 'levels', 'recursion', 'deep'],
      },
      {
        key: SETTING_KEYS.SCAN_EXCLUDED_DIRECTORIES,
        label: 'Excluded Directories',
        description: 'Directories to ignore when scanning and calculating project statistics.',
        keywords: ['ignore', 'skip', 'exclude', 'node_modules'],
      },
    ],
  },
  {
    id: 'default-applications',
    title: 'Default Applications',
    description: 'Set your preferred IDE and terminal for opening projects',
    icon: AppWindow,
    settings: [
      {
        key: SETTING_KEYS.DEFAULT_IDE,
        label: 'Default IDE',
        description: 'Choose which IDE to use when opening projects.',
        keywords: ['editor', 'vscode', 'cursor', 'webstorm', 'zed'],
      },
      {
        key: SETTING_KEYS.DEFAULT_TERMINAL,
        label: 'Default Terminal',
        description: 'Choose which terminal to use when opening projects.',
        keywords: ['shell', 'iterm', 'warp', 'ghostty', 'console'],
      },
    ],
  },
  {
    id: 'appearance',
    title: 'Appearance',
    description: 'Customize how Barnacles appears on your system',
    icon: Palette,
    settings: [
      {
        key: SETTING_KEYS.THEMES,
        label: 'Theme',
        description: 'Choose the colors Barnacles uses.',
        keywords: ['dark', 'light', 'colors', 'appearance', 'mode'],
      },
      {
        key: SETTING_KEYS.SHOW_DASHBOARD_STATS,
        label: 'Show Git Statistics on Dashboard',
        description: 'Display your git commit statistics and streaks on the dashboard.',
        keywords: ['commits', 'streaks', 'home', 'heatmap'],
      },
      {
        key: SETTING_KEYS.REDUCED_MOTION,
        label: 'Reduce Motion',
        description: 'Turn down animations like icon transitions and spinners.',
        keywords: ['animation', 'motion', 'accessibility', 'transitions', 'vestibular'],
      },
      {
        key: SETTING_KEYS.SHOW_TRAY_ICON,
        label: 'Show Tray Icon',
        description: 'Display the Barnacles icon in the system tray for quick access.',
        keywords: ['menu bar', 'status bar', 'menubar', 'system tray'],
      },
    ],
  },
  {
    id: 'keyboard-shortcuts',
    title: 'Keyboard Shortcuts',
    description: 'Choose how you open the command palette',
    icon: Keyboard,
    settings: [
      {
        key: SETTING_KEYS.COMMAND_PALETTE_SHORTCUT,
        label: 'Command Palette Shortcut',
        description: 'The global shortcut that opens the command palette.',
        keywords: ['hotkey', 'keybinding', 'accelerator', 'global', 'palette'],
      },
    ],
  },
  {
    id: 'git-stats',
    title: 'Git Stats',
    description: 'Configure how git statistics are calculated',
    icon: GitBranch,
    settings: [
      {
        key: SETTING_KEYS.GIT_EMAILS,
        label: 'Git Author Emails',
        description: 'Email addresses used for your commits across projects.',
        keywords: ['author', 'email', 'commits', 'contributions'],
      },
    ],
  },
  {
    id: 'developer-tools',
    title: 'Developer Tools',
    description: 'Configure command-line tools and integrations',
    icon: Wrench,
    settings: [
      {
        key: SETTING_KEYS.INSTALL_CLI_COMMAND,
        label: 'CLI Command',
        description: 'Install the barnacles command for your terminal.',
        keywords: ['terminal', 'command line', 'install', 'shell', 'path'],
      },
      {
        key: SETTING_KEYS.MCP_SERVER,
        label: 'MCP Server',
        description: 'Expose Barnacles to AI clients over the Model Context Protocol.',
        keywords: ['model context protocol', 'ai', 'claude', 'server'],
      },
      {
        key: SETTING_KEYS.MCP_USAGE_LOGGING,
        label: 'MCP usage logging',
        description: 'Record each MCP tool call made against Barnacles.',
        keywords: ['logs', 'telemetry', 'history', 'analytics', 'mcp'],
      },
    ],
  },
];

/**
 * Every setting, flattened, each tagged with the section it belongs to.
 *
 * This is the array the fuzzy search runs over -- a match needs to know its
 * section to scroll to the right place and to group itself in the sidebar.
 */
export interface FlatSettingDef extends SettingDef {
  sectionId: string;
  sectionTitle: string;
}

export const ALL_SETTINGS: FlatSettingDef[] = SETTINGS_SECTIONS.flatMap(section =>
  section.settings.map(setting => ({
    ...setting,
    sectionId: section.id,
    sectionTitle: section.title,
  }))
);
