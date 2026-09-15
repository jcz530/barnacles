import { computed, ref } from 'vue';
import type { RouteLocationNormalized } from 'vue-router';

/** Where settings sends you when nothing better is known. */
export const SETTINGS_RETURN_FALLBACK = '/';

/**
 * Routes that are part of settings rather than somewhere you came from.
 *
 * Themes and the theme editor are reached from inside settings and render as
 * its children, so returning to one of them would leave you exactly where you
 * were trying to get out of.
 */
const SETTINGS_PATHS = ['/settings', '/themes'];

function isSettingsPath(path: string) {
  return SETTINGS_PATHS.some(prefix => path === prefix || path.startsWith(`${prefix}/`));
}

/**
 * The last page visited before settings, for "Back to app" and Escape.
 *
 * Recorded as navigation happens rather than read from history on the way out:
 * `router.back()` would retrace the last entry, which sends you *deeper* into
 * settings when you arrived at /settings from /themes, and lands on whatever
 * page preceded the app entirely when settings was opened from a cold start.
 *
 * Chromeless windows (the tray popup, the command palette, the find overlay)
 * are never recorded -- they are not pages you were on, and returning to one
 * inside the main window would strand you on a surface with no navigation.
 */
const lastAppPath = ref<string | null>(null);

/**
 * The utility windows. They render outside DefaultLayout, so there is no
 * sidebar to come back to and returning to one would strand you.
 *
 * Spelled out rather than imported from the router: the router imports this
 * module for its afterEach, and importing RouteNames back would close a cycle
 * for the sake of three string literals.
 */
const CHROMELESS_ROUTES = ['TrayPopup', 'FindOverlay', 'CommandPalette'];

/** Called from the router's afterEach. */
export function recordSettingsReturn(to: RouteLocationNormalized) {
  if (isSettingsPath(to.path)) return;
  if (CHROMELESS_ROUTES.includes(to.name as string)) return;

  lastAppPath.value = to.path;
}

export function useSettingsReturn() {
  /**
   * Where to go when leaving settings. Falls back to the dashboard when there
   * is no clear signal -- settings opened from a cold start, or reached only
   * from other settings pages.
   */
  const returnPath = computed(() => lastAppPath.value ?? SETTINGS_RETURN_FALLBACK);

  return { returnPath };
}
