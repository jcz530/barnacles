import {
  ChartNoAxesColumn,
  FileText,
  FolderGit2,
  Network,
  Palette,
  Plug,
  Radio,
  Settings as SettingsIcon,
  Sparkles,
  SquareTerminal,
  Terminal,
  type LucideIcon,
} from 'lucide-vue-next';

export interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Extra fuzzy-search terms for the command palette. Not shown in the sidebar. */
  keywords?: string[];
}

/**
 * Primary sidebar destinations.
 *
 * Shared with the command palette's navigation provider so a new page shows up
 * in both places from one edit. The sidebar layers reactive `isActive`, `count`,
 * and `items` on top of these; anything reactive belongs there, not here.
 */
export const NAV_MAIN: NavItem[] = [
  { title: 'Dashboard', url: '/', icon: SquareTerminal, keywords: ['home', 'overview'] },
  { title: 'Projects', url: '/projects', icon: FolderGit2, keywords: ['repos', 'barnacles'] },
  {
    title: 'Processes',
    url: '/terminals',
    icon: SquareTerminal,
    keywords: ['running', 'servers', 'dev'],
  },
  { title: 'Ports', url: '/ports', icon: Radio, keywords: ['listening', 'localhost'] },
  { title: 'Stats', url: '/stats', icon: ChartNoAxesColumn, keywords: ['metrics', 'git'] },
  { title: 'Utilities', url: '/utilities', icon: Sparkles, keywords: ['tools', 'color', 'exif'] },
  { title: 'MCP', url: '/mcp', icon: Plug, keywords: ['model context protocol', 'ai', 'claude'] },
];

/**
 * Secondary sidebar destinations.
 */
export const NAV_SECONDARY: NavItem[] = [
  { title: 'Hosts', url: '/hosts', icon: Network, keywords: ['etc hosts', 'dns'] },
  { title: 'Aliases', url: '/aliases', icon: Terminal, keywords: ['shell', 'bash', 'zsh'] },
  { title: 'Config Files', url: '/configs', icon: FileText, keywords: ['dotfiles', 'rc'] },
];

/**
 * Reachable pages that have no sidebar entry. Palette-only.
 */
export const NAV_EXTRA: NavItem[] = [
  {
    title: 'Settings',
    url: '/settings',
    icon: SettingsIcon,
    keywords: ['preferences', 'options', 'config'],
  },
  { title: 'Themes', url: '/themes', icon: Palette, keywords: ['appearance', 'colors', 'dark'] },
];

/**
 * Every navigable destination, for the command palette.
 */
export const ALL_NAV_ITEMS: NavItem[] = [...NAV_MAIN, ...NAV_SECONDARY, ...NAV_EXTRA];
