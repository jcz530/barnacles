/**
 * Demo project fixtures.
 *
 * Hand-authored rather than generated: screenshots must be byte-stable across
 * runs, and generated names ("Handcrafted Rubber Sausages") make poor marketing
 * assets. IDs are stable so the screenshot manifest can hard-code routes.
 *
 * Paths intentionally live under /Users/dev — a username that does not exist on
 * any real machine — so nothing leaks into a published screenshot and the
 * rescan scheduler's fs.access check fails deterministically.
 */

export const DEMO_PATH_ROOT = '/Users/dev/Development';

export interface DemoProject {
  id: string;
  name: string;
  path: string;
  description: string;
  /** Slugs from TECHNOLOGY_DETECTORS; names/colors/icons are pulled from there. */
  technologies: string[];
  lastModifiedDaysAgo: number;
  createdDaysAgo: number;
  /** Bytes. */
  size: number;
  isFavorite: boolean;
  preferredIde?: string;
  preferredTerminal?: string;
}

export const DEMO_PROJECTS: DemoProject[] = [
  {
    id: 'demo-proj-01',
    name: 'harbor-api',
    path: `${DEMO_PATH_ROOT}/harbor-api`,
    description: 'GraphQL API gateway for the Harbor platform',
    technologies: ['typescript', 'nodejs', 'docker', 'git'],
    lastModifiedDaysAgo: 0,
    createdDaysAgo: 412,
    size: 184_320_000,
    isFavorite: true,
    preferredIde: 'vscode',
    preferredTerminal: 'iterm2',
  },
  {
    id: 'demo-proj-02',
    name: 'tidepool',
    path: `${DEMO_PATH_ROOT}/tidepool`,
    description: 'Design system and component library',
    technologies: ['vue', 'typescript', 'tailwindcss', 'vite'],
    lastModifiedDaysAgo: 1,
    createdDaysAgo: 236,
    size: 96_468_992,
    isFavorite: true,
  },
  {
    id: 'demo-proj-03',
    name: 'lighthouse-web',
    path: `${DEMO_PATH_ROOT}/lighthouse-web`,
    description: 'Marketing site and docs portal',
    technologies: ['nextjs', 'react', 'typescript', 'tailwindcss'],
    lastModifiedDaysAgo: 2,
    createdDaysAgo: 178,
    size: 142_606_336,
    isFavorite: false,
  },
  {
    id: 'demo-proj-04',
    name: 'sextant',
    path: `${DEMO_PATH_ROOT}/sextant`,
    description: 'Telemetry ingestion and metrics pipeline',
    technologies: ['rust', 'docker', 'git'],
    lastModifiedDaysAgo: 3,
    createdDaysAgo: 320,
    size: 58_720_256,
    isFavorite: false,
  },
  {
    id: 'demo-proj-05',
    name: 'ballast',
    path: `${DEMO_PATH_ROOT}/ballast`,
    description: 'Background job runner and scheduler',
    technologies: ['go', 'docker'],
    lastModifiedDaysAgo: 5,
    createdDaysAgo: 501,
    size: 31_457_280,
    isFavorite: false,
  },
  {
    id: 'demo-proj-06',
    name: 'driftwood',
    path: `${DEMO_PATH_ROOT}/driftwood`,
    description: 'Data science notebooks and forecasting models',
    technologies: ['python', 'django', 'git'],
    lastModifiedDaysAgo: 8,
    createdDaysAgo: 289,
    size: 268_435_456,
    isFavorite: false,
  },
  {
    id: 'demo-proj-07',
    name: 'seaglass',
    path: `${DEMO_PATH_ROOT}/seaglass`,
    description: 'Cross-platform desktop client',
    technologies: ['electron', 'vue', 'typescript'],
    lastModifiedDaysAgo: 12,
    createdDaysAgo: 145,
    size: 412_090_368,
    isFavorite: true,
  },
  {
    id: 'demo-proj-08',
    name: 'mooring-mobile',
    path: `${DEMO_PATH_ROOT}/mooring-mobile`,
    description: 'iOS and Android companion app',
    technologies: ['reactnative', 'typescript', 'expo'],
    lastModifiedDaysAgo: 16,
    createdDaysAgo: 97,
    size: 203_423_744,
    isFavorite: false,
  },
  {
    id: 'demo-proj-09',
    name: 'anchor-admin',
    path: `${DEMO_PATH_ROOT}/anchor-admin`,
    description: 'Internal admin dashboard',
    technologies: ['laravel', 'php', 'tailwindcss'],
    lastModifiedDaysAgo: 24,
    createdDaysAgo: 634,
    size: 88_080_384,
    isFavorite: false,
  },
  {
    id: 'demo-proj-10',
    name: 'kelp',
    path: `${DEMO_PATH_ROOT}/kelp`,
    description: 'CLI utilities for local development',
    technologies: ['rust', 'git'],
    lastModifiedDaysAgo: 31,
    createdDaysAgo: 205,
    size: 12_582_912,
    isFavorite: false,
  },
  {
    id: 'demo-proj-11',
    name: 'spindrift',
    path: `${DEMO_PATH_ROOT}/spindrift`,
    description: 'Realtime collaboration prototype',
    technologies: ['nuxt', 'vue', 'typescript'],
    lastModifiedDaysAgo: 45,
    createdDaysAgo: 132,
    size: 74_448_896,
    isFavorite: false,
  },
  {
    id: 'demo-proj-12',
    name: 'reef-scheduler',
    path: `${DEMO_PATH_ROOT}/reef-scheduler`,
    description: 'Cron orchestration service',
    technologies: ['java', 'docker'],
    lastModifiedDaysAgo: 63,
    createdDaysAgo: 720,
    size: 52_428_800,
    isFavorite: false,
  },
];

/** The project whose detail tabs are captured for screenshots. */
export const DEMO_FEATURED_PROJECT_ID = 'demo-proj-01';
