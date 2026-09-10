/**
 * Tables driving project icon detection.
 *
 * Every weight here encodes a judgement call that is hard to re-derive later, so
 * each one carries the reason it holds the value it does. `icon-scoring.test.ts`
 * pins the resulting orderings: a tweak that inverts a ranking fails loudly
 * rather than silently changing which icon a project shows.
 */

/**
 * Where a candidate came from. Declared sources are icons the project itself
 * names in config; conventional ones are inferred from where the file sits.
 */
export type IconSource =
  'electron-builder' | 'html-link' | 'framework-config' | 'webmanifest' | 'convention' | 'glob';

/**
 * A project naming its own icon beats any amount of guessing, so declared
 * sources sit an order of magnitude above conventions. `electron-builder` leads
 * because it names *the application's* icon rather than a web favicon.
 */
export const SOURCE_WEIGHT: Record<IconSource, number> = {
  'electron-builder': 1000,
  'html-link': 900,
  'framework-config': 900,
  // Below the link tiers: a manifest lists the icons a *browser* should install
  // (often only a padded PNG) rather than the one that best represents the
  // project, and it routinely omits an SVG sitting right beside it.
  webmanifest: 700,
  convention: 500,
  glob: 100,
};

/**
 * Any candidate at or above this score is a declared icon, which is as good an
 * answer as we can get -- later tiers are skipped rather than run for nothing.
 */
export const CONFIDENT_SCORE = 900;

/**
 * Matched against the lowercased basename, first rule wins. The spread here
 * (40-120) is deliberately wider than EXT_WEIGHT's (10-50) so that *what a file
 * is called* outranks *what format it is in*.
 */
export const NAME_RULES: Array<{ test: RegExp; weight: number }> = [
  { test: /^favicon(-\d+x\d+)?$/, weight: 120 },
  { test: /^icon(-\d+x\d+)?$/, weight: 110 },
  { test: /^app-?icon$/, weight: 110 },
  { test: /^logo-?mark$/, weight: 100 },
  { test: /^logo$/, weight: 95 },
  // electron-builder's conventional basename, as in `icon: assets/icons/app`.
  { test: /^app$/, weight: 90 },
  // Real, but 180px and usually padded with an opaque background -- a worse
  // small glyph than a favicon of the same project.
  { test: /^apple-touch-icon/, weight: 70 },
  // logo-dark, logo@2x: a variant of the logo rather than the logo itself.
  { test: /^logo[-@]/, weight: 60 },
  { test: /^(android-chrome|mstile)/, weight: 40 },
  // Recognized so they can be *rejected*: these read as icons by name, so
  // without a rule they would be silently invisible rather than scored and
  // ranked last by MONOCHROME_HINT. Keeping them visible is what lets a
  // project whose only icon is a mask still lose to a real one.
  { test: /^(safari-)?pinned-tab/, weight: 30 },
  { test: /(icon|logo).*template$/, weight: 30 },
  { test: /^(icon|favicon|logo)[-_](mono|symbolic)$/, weight: 30 },
];

/**
 * Extensions we will store. `.icns` is deliberately absent: no browser renders
 * it in an <img>, so storing one guarantees a silent permanent fallback to the
 * folder glyph. declared-sources.ts rewrites `.icns` to its sibling instead.
 *
 * Order is the preference used when expanding an extension-less declared path.
 */
export const RENDERABLE_EXTENSIONS = [
  '.svg',
  '.png',
  '.webp',
  '.ico',
  '.jpg',
  '.jpeg',
  '.gif',
] as const;

/**
 * `.svg` scales to any size; `.ico` is often 16x16 and looks soft at the 32px
 * render size; animated `.gif` makes a poor 24px project glyph.
 *
 * Format is the *weakest* signal in the model: it breaks ties between otherwise
 * comparable files. The whole spread stays below every penalty and every gap
 * between adjacent name rules, so a better format can never rescue a candidate
 * that lost on location, provenance, or name -- a built copy or a docs sub-app
 * must not win just for shipping an SVG.
 */
export const EXT_WEIGHT: Record<string, number> = {
  '.svg': 45,
  '.png': 30,
  '.ico': 18,
  '.webp': 15,
  '.jpg': 8,
  '.jpeg': 8,
  '.gif': 5,
};

/**
 * Content types for the icon and file routes. Shared so the detector's notion of
 * "renderable" and the server's notion of "servable" cannot drift -- that drift
 * is exactly how a stored icon ends up 404ing or served as octet-stream.
 */
export const IMAGE_CONTENT_TYPES: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
};

export const PENALTIES = {
  /**
   * Larger than the entire convention-tier spread, so a built copy can never
   * outrank the source it was built from. A penalty rather than an exclusion so
   * a project that ships *only* a built copy still gets an icon.
   */
  BUILD_OUTPUT: -400,
  /**
   * Images that are a single-colour mask rather than artwork: Apple's
   * `Template` suffix, and Safari's pinned-tab icon, which is required to be a
   * monochrome silhouette. Both render as a black blob in an <img>.
   */
  MONOCHROME_HINT: -300,
  /** Per level of nesting: a root icon describes the project better. */
  NESTED_APP: -30,
  /** A docs/tooling sub-app is rarely the face of the repository. */
  SUPPORTING_ROLE: -80,
};

/** Directory segments that mark compiled output mirroring a source tree. */
export const BUILD_OUTPUT_SEGMENTS = [
  'dist',
  'build',
  '.output',
  '.nuxt',
  '.next',
  '.svelte-kit',
  'out',
  'spa',
];

/** Nested app directories whose role is support, not the product itself. */
export const SUPPORTING_ROLE_DIRS = [
  'docs',
  'docs-site',
  'documentation',
  'website',
  'storybook',
  'examples',
  'example',
  'e2e',
  'tests',
  'test',
];

/**
 * Never descended into. Beyond the obvious cost, several of these hold decoys:
 * node_modules is full of package favicons, .idea ships an icon.svg, and a
 * Chrome profile under .profile holds a binary `Favicons` SQLite database.
 */
export const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'vendor',
  'dist',
  'build',
  '.output',
  '.nuxt',
  '.next',
  '.svelte-kit',
  '.turbo',
  '.cache',
  '.parcel-cache',
  'coverage',
  'target',
  'venv',
  '.venv',
  '__pycache__',
  '.idea',
  '.vscode',
  'storage',
  'test-results',
  'playwright-report',
  'tmp',
  'temp',
  '.profile',
  '.demo-data',
]);

/**
 * Conventional icon locations, searched relative to an app root. Includes one
 * level below public/ and static/, which is where projects that keep a set of
 * generated favicons tend to put them.
 */
export const CONVENTION_DIRS = [
  '',
  'public',
  'static',
  'assets',
  'src',
  'resources',
  'app',
  'assets/icons',
  'assets/images',
  'public/assets',
  'public/images',
  'public/img',
  'public/icons',
  'public/favicon',
  'static/images',
  'static/icons',
  'static/favicon',
  'src/assets',
  'src/assets/images',
  'src/assets/icons',
  'images',
  'icons',
];

/** A child directory holding one of these is its own application. */
export const NESTED_APP_MARKERS = [
  'package.json',
  'nuxt.config.ts',
  'nuxt.config.js',
  'astro.config.mjs',
  'astro.config.ts',
  'vite.config.ts',
  'vite.config.js',
  'next.config.js',
  'next.config.mjs',
];

/** Common names for a nested app, checked before falling back to a scan. */
export const NESTED_APP_DIRS = [
  'frontend',
  'web',
  'client',
  'app',
  'site',
  'www',
  'ui',
  'dashboard',
  'docs-site',
  'apps',
  'packages',
  'sites',
];

export const LIMITS = {
  /** Deep enough for apps/<name>/public/<file>, shallow enough to stay cheap. */
  MAX_DEPTH: 4,
  MAX_DIRS_VISITED: 300,
  MAX_CANDIDATES: 40,
  MAX_NESTED_APPS: 4,
  /** Config files are small; refuse to read something pathological. */
  MAX_CONFIG_BYTES: 64 * 1024,
  /** Layout files scanned per directory when hunting for a `<link rel=icon>`. */
  MAX_HEAD_FILES: 12,
  /** Bound parallel fs work so scanning many projects cannot starve libuv. */
  CONCURRENCY: 8,
};
