import { describe, it, expect, beforeEach } from 'vitest';
import type { RouteLocationNormalized } from 'vue-router';
import {
  recordSettingsReturn,
  useSettingsReturn,
  SETTINGS_RETURN_FALLBACK,
} from './useSettingsReturn';

/** Only the fields the recorder reads. */
function route(path: string, name = path): RouteLocationNormalized {
  return { path, name } as unknown as RouteLocationNormalized;
}

/** Clears the module-level memory between tests. */
function reset() {
  recordSettingsReturn(route(SETTINGS_RETURN_FALLBACK, 'Home'));
}

describe('useSettingsReturn', () => {
  beforeEach(reset);

  it('falls back to the dashboard before anywhere has been visited', () => {
    // Nothing recorded yet beyond the reset, so the fallback is what is left.
    expect(useSettingsReturn().returnPath.value).toBe(SETTINGS_RETURN_FALLBACK);
  });

  it('returns to the page visited before settings', () => {
    recordSettingsReturn(route('/ports', 'Ports'));
    recordSettingsReturn(route('/settings', 'Settings'));

    expect(useSettingsReturn().returnPath.value).toBe('/ports');
  });

  it('keeps the page you came from while you move around inside settings', () => {
    recordSettingsReturn(route('/stats', 'Stats'));
    recordSettingsReturn(route('/settings', 'Settings'));
    // Settings -> Themes -> back into Settings. Themes is reached from inside
    // settings, so returning there would leave you where you started.
    recordSettingsReturn(route('/themes', 'Themes'));
    recordSettingsReturn(route('/themes/abc/edit', 'ThemeEdit'));
    recordSettingsReturn(route('/settings', 'Settings'));

    expect(useSettingsReturn().returnPath.value).toBe('/stats');
  });

  it('remembers a nested page with its full path', () => {
    recordSettingsReturn(route('/projects/demo-proj-01/overview', 'ProjectOverview'));
    recordSettingsReturn(route('/settings', 'Settings'));

    expect(useSettingsReturn().returnPath.value).toBe('/projects/demo-proj-01/overview');
  });

  it('tracks the most recent page, not the first', () => {
    recordSettingsReturn(route('/ports', 'Ports'));
    recordSettingsReturn(route('/hosts', 'Hosts'));
    recordSettingsReturn(route('/settings', 'Settings'));

    expect(useSettingsReturn().returnPath.value).toBe('/hosts');
  });

  it('never returns to a utility window', () => {
    recordSettingsReturn(route('/aliases', 'Aliases'));
    // These render outside DefaultLayout; landing on one would strand you.
    recordSettingsReturn(route('/tray-popup', 'TrayPopup'));
    recordSettingsReturn(route('/command-palette', 'CommandPalette'));
    recordSettingsReturn(route('/find-overlay', 'FindOverlay'));

    expect(useSettingsReturn().returnPath.value).toBe('/aliases');
  });
});
