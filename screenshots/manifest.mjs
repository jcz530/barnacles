/**
 * Screenshot manifest — the single source of truth shared by the capture script
 * (scripts/capture-screenshots.mjs) and the update-screenshots skill.
 *
 * `name`/`route`/`storage` drive capture. `title`/`description`/`alt`/`targets`
 * drive publication, so a screenshot and the copy describing it stay together
 * instead of drifting apart in two repos.
 *
 * Routes are hash routes. Demo project ids are stable (see
 * src/shared/database/demo/data/projects.ts), so detail routes are hard-coded
 * and need no runtime resolution.
 *
 * @typedef {Object} MarketingTarget
 * @property {number|'new'} stepId  Existing AppShowcase step to update, or 'new' to append.
 * @property {string} file          Basename under public/images/screenshots/.
 * @property {string} [icon]
 * @property {string} [color]
 * @property {string[]} [features]
 *
 * @typedef {Object} ShotSpec
 * @property {string} name          File stem: <name>-<theme>.png
 * @property {string} route         Hash route, without the leading '#'.
 * @property {Object<string,string>} [storage]  localStorage seeded BEFORE the captured load (bare string values).
 * @property {string} [afterLoad]   JS evaluated AFTER data settles — acts on rendered UI (e.g. scroll).
 * @property {number} [settleMs]    Extra settle time for heavy views.
 * @property {boolean} [manual]     Captured by hand; the script skips it.
 * @property {string} title
 * @property {string} description
 * @property {string} alt
 * @property {{readme?: {marker: string}, marketing?: MarketingTarget}} targets
 */

const FEATURED = 'demo-proj-01';

/**
 * localStorage state seeded before the captured load. More reliable than
 * clicking a toggle by DOM position, and set explicitly on every shot that
 * renders the projects list so none inherits the view left by the shot before.
 *
 * Values are bare strings, matching what the app persists — a JSON-quoted value
 * fails to parse and silently falls back to the default.
 */
const projectsView = view => ({ 'projects-view-mode': view });

/** @type {ShotSpec[]} */
export const SHOTS = [
  {
    name: 'dashboard',
    route: '/',
    title: 'Instant Project Discovery',
    description:
      'Stop digging through nested folders. Barnacles automatically scans your file system and catalogs all your development projects in one searchable interface.',
    alt: 'Barnacles dashboard showing discovered projects at a glance',
    targets: {
      readme: { marker: 'dashboard' },
      marketing: { stepId: 1, file: 'dashboard' },
    },
  },
  {
    name: 'projects-table',
    route: '/projects',
    storage: projectsView('table'),
    title: 'Every Project in One Table',
    description:
      'Scan your entire catalog at a glance — language, framework, Git branch, and last modified date, sortable by any column.',
    alt: 'Projects list in table view with technology and Git columns',
    targets: {
      readme: { marker: 'projects-table' },
    },
  },
  {
    name: 'projects-cards',
    route: '/projects',
    storage: projectsView('card'),
    title: 'Smart Filtering & Organization',
    description:
      'Working on React projects today? Python tomorrow? Filter your entire project catalog by technology, language, or framework. Sort by last modified to jump back into recent work.',
    alt: 'Projects list in card view with technology badges',
    targets: {
      readme: { marker: 'projects-cards' },
      marketing: { stepId: 4, file: 'projects-cards' },
    },
  },
  {
    name: 'project-details',
    route: `/projects/${FEATURED}/overview`,
    title: 'Project Overview at a Glance',
    description:
      'Git branch, commit history, size, and quick actions for a single project — without opening a terminal.',
    alt: 'Project overview tab showing Git information and quick actions',
    targets: {
      readme: { marker: 'project-details' },
      marketing: { stepId: 2, file: 'project-details' },
    },
  },
  {
    // The language breakdown and file statistics live on the Overview tab; the
    // Files tab is a browser. Scrolled down so the stats cards are in frame.
    name: 'project-file-stats',
    route: `/projects/${FEATURED}/overview`,
    afterLoad: `window.scrollTo(0, 620)`,
    settleMs: 500,
    title: 'Real-Time Project Insights',
    description:
      "Get instant visibility into every project's status. See lines of code, language breakdown, Git branch information, and last modified dates—all without opening a single file.",
    alt: 'Language breakdown and file statistics for a project',
    targets: {
      readme: { marker: 'project-file-stats' },
      marketing: { stepId: 2, file: 'project-file-stats' },
    },
  },
  {
    name: 'project-files',
    route: `/projects/${FEATURED}/files`,
    title: 'Browse Project Files',
    description: 'Explore a project’s file tree and read any file without leaving Barnacles.',
    alt: 'Project file browser with a file tree',
    targets: {},
  },
  {
    name: 'project-readme',
    route: `/projects/${FEATURED}/readme`,
    // Shiki highlights code blocks after the network settles.
    settleMs: 900,
    title: 'READMEs Without Leaving the App',
    description:
      'Read any project’s documentation with syntax-highlighted code blocks, rendered inline.',
    alt: 'Rendered project README with syntax highlighting',
    targets: {},
  },
  {
    // Shows the detected npm scripts and the run/IDE/terminal actions. The
    // process list itself stays empty because both process views render *live*
    // running processes — populating it would mean spawning real child
    // processes during capture, which is out of scope for a screenshot run.
    name: 'processes',
    route: `/projects/${FEATURED}/terminals`,
    title: 'Quick Actions',
    description:
      'Stop the ceremony of navigating to folders and launching tools. Open projects in your IDE, start terminals in the right directory, or run any detected script—all with a single click.',
    alt: 'Detected npm scripts with one-click run, IDE, and terminal actions',
    targets: {
      readme: { marker: 'processes' },
      marketing: { stepId: 3, file: 'processes' },
    },
  },
  {
    name: 'project-accounts',
    route: `/projects/${FEATURED}/accounts`,
    title: 'Per-Project Credentials',
    description:
      'Keep the accounts tied to a project alongside it, with passwords encrypted at rest on your own machine.',
    alt: 'Project accounts tab listing saved credentials',
    targets: {},
  },
  // NOTE: /terminals is not captured. It lists *live* running processes, so it
  // renders an empty state unless real processes are spawned during capture.
  // NOTE: /ports is deliberately not captured, for the same reason as /configs
  // and /hosts: it reports live OS state via lsof, including the real working
  // directory of every listening process — which puts the capturing machine's
  // username and project paths into a published screenshot. Demo data cannot
  // mask it, because the page reads the process table rather than the database.
  {
    name: 'settings',
    route: '/settings',
    title: 'Settings',
    description: 'Configure scanning, appearance, and integrations to match your workflow.',
    alt: 'Barnacles settings page',
    targets: {
      readme: { marker: 'settings' },
    },
  },
  {
    name: 'themes',
    route: '/themes',
    title: 'Make It Yours',
    description:
      'Pick a theme or build your own — colors, fonts, and border radius, applied across the whole app.',
    alt: 'Theme gallery with selectable colour palettes',
    targets: {
      readme: { marker: 'themes' },
    },
  },
  {
    name: 'aliases',
    route: '/aliases',
    title: 'Shell Aliases, Organized',
    description:
      'Manage your shell aliases in one place, grouped by category and colour-coded in your terminal.',
    alt: 'Alias manager grouped by category',
    targets: {
      readme: { marker: 'aliases' },
    },
  },
  // NOTE: /hosts is deliberately not captured, for the same reason as /configs:
  // it renders the machine's real /etc/hosts, which typically contains client
  // and project names plus LAN addresses.
  // NOTE: /configs is deliberately not captured. That page reads the real home
  // directory — publishing it would expose the machine's actual dotfile
  // inventory (.ssh, .netrc, .gitconfig and their sizes). Demo data cannot mask
  // it, because the page reads the filesystem rather than the database.
  {
    name: 'utilities',
    route: '/utilities',
    title: 'Built-in Developer Utilities',
    description:
      'Colour conversion, shade generation, EXIF inspection, and IP lookup — bundled in, no browser tab required.',
    alt: 'Developer utilities gallery',
    targets: {
      readme: { marker: 'utilities' },
    },
  },
  {
    name: 'cli',
    route: '',
    manual: true,
    title: 'Full Command-Line Interface',
    description:
      'Prefer the terminal? Barnacles includes a full-featured CLI that brings all the power of the GUI to your command line. Browse projects interactively and launch tools—all from your favorite terminal.',
    alt: 'Barnacles CLI listing projects in a terminal',
    targets: {
      readme: { marker: 'cli' },
      marketing: { stepId: 5, file: 'cli' },
    },
  },
];

/** Themes captured for every non-manual shot. */
export const THEMES = ['light', 'dark'];

/** Output filename for a shot in a given theme. */
export function outputFileName(shot, theme) {
  return `${shot.name}-${theme}.png`;
}
