import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createIntegrationTestContext } from '@test/contexts';
import { get, put } from '@test/helpers/api-client';
import { SETTING_KEYS } from '@shared/types/api';

interface SettingBody {
  key: string;
  value: string;
}

/** The helper hands back `data: unknown`; these narrow it at the call site. */
const asSetting = (data: unknown) => (data as { data: SettingBody }).data;
const asSettingList = (data: unknown) => (data as { data: SettingBody[] }).data;
const asWarning = (data: unknown) => (data as { warning?: string }).warning;

/**
 * The settings route reaches into the main process for settings with system
 * side effects. None of that exists under test, so it is stubbed here and the
 * palette hook's registration result is driven per-test.
 */
const syncCommandPaletteShortcut = vi.fn();

vi.mock('../../../../main/main', () => ({
  toggleTrayIcon: vi.fn(),
  toggleCliInstallation: vi.fn(),
  syncCommandPaletteShortcut: () => syncCommandPaletteShortcut(),
}));

describe('Settings API Integration Tests', () => {
  const context = createIntegrationTestContext();

  beforeEach(async () => {
    syncCommandPaletteShortcut.mockReset();
    syncCommandPaletteShortcut.mockResolvedValue({ success: true });

    await context.setup(async () => {
      const { Hono } = await import('hono');
      const { errorHandler } = await import('@backend/middleware/error-handler');
      const settings = (await import('@backend/routes/settings')).default;
      const app = new Hono();
      app.onError(errorHandler);
      app.route('/api/settings', settings);
      return app;
    });
  });

  describe('command palette shortcut settings', () => {
    it('falls back to defaults when nothing has been saved', async () => {
      const response = await get(context.get().app, '/api/settings');

      expect(response.status).toBe(200);
      const keys = asSettingList(response.data).map((setting: { key: string }) => setting.key);
      expect(keys).toContain(SETTING_KEYS.COMMAND_PALETTE_SHORTCUT);
      expect(keys).toContain(SETTING_KEYS.COMMAND_PALETTE_SHORTCUT_ENABLED);

      const enabled = asSettingList(response.data).find(
        (setting: { key: string }) => setting.key === SETTING_KEYS.COMMAND_PALETTE_SHORTCUT_ENABLED
      );
      // A system-wide hotkey has to be opted into.
      expect(String(enabled.value)).toBe('false');
    });

    it('persists a recorded accelerator', async () => {
      const response = await put(
        context.get().app,
        `/api/settings/${SETTING_KEYS.COMMAND_PALETTE_SHORTCUT}`,
        { value: 'CommandOrControl+Alt+K', type: 'string' }
      );

      expect(response.status).toBe(200);
      expect(asSetting(response.data).value).toBe('CommandOrControl+Alt+K');
      expect(syncCommandPaletteShortcut).toHaveBeenCalledTimes(1);

      const readBack = await get(
        context.get().app,
        `/api/settings/${SETTING_KEYS.COMMAND_PALETTE_SHORTCUT}`
      );
      expect(asSetting(readBack.data).value).toBe('CommandOrControl+Alt+K');
    });

    it('rebinds the hotkey when the toggle changes', async () => {
      const response = await put(
        context.get().app,
        `/api/settings/${SETTING_KEYS.COMMAND_PALETTE_SHORTCUT_ENABLED}`,
        { value: true, type: 'boolean' }
      );

      expect(response.status).toBe(200);
      expect(syncCommandPaletteShortcut).toHaveBeenCalledTimes(1);
    });

    it('keeps the value and reports a warning when the OS refuses the combo', async () => {
      syncCommandPaletteShortcut.mockResolvedValue({
        success: false,
        error: '"CommandOrControl+Space" is already in use by another application.',
      });

      const response = await put(
        context.get().app,
        `/api/settings/${SETTING_KEYS.COMMAND_PALETTE_SHORTCUT}`,
        { value: 'CommandOrControl+Space', type: 'string' }
      );

      // 200, not an error: the preference saved. Only the OS-level grab failed,
      // and a 4xx would read as the value having been lost.
      expect(response.status).toBe(200);
      expect(asWarning(response.data)).toContain('already in use');

      const readBack = await get(
        context.get().app,
        `/api/settings/${SETTING_KEYS.COMMAND_PALETTE_SHORTCUT}`
      );
      expect(asSetting(readBack.data).value).toBe('CommandOrControl+Space');
    });

    it('does not touch the hotkey for unrelated settings', async () => {
      await put(context.get().app, `/api/settings/${SETTING_KEYS.SHOW_DASHBOARD_STATS}`, {
        value: false,
        type: 'boolean',
      });

      expect(syncCommandPaletteShortcut).not.toHaveBeenCalled();
    });
  });

  describe('numeric setting validation', () => {
    /**
     * NaN has no JSON literal, so an emptied `v-model.number` input reaches the
     * API as null. Stored via String(), that became "null" and read back as
     * NaN; since every `depth > NaN` comparison is false, scanning silently
     * found nothing instead of failing.
     */
    it('rejects a null value for a numeric setting', async () => {
      const response = await put(
        context.get().app,
        `/api/settings/${SETTING_KEYS.SCAN_MAX_DEPTH}`,
        {
          value: null,
          type: 'number',
        }
      );

      expect(response.status).toBe(400);
    });

    it('does not persist a rejected numeric value', async () => {
      await put(context.get().app, `/api/settings/${SETTING_KEYS.SCAN_MAX_DEPTH}`, {
        value: 5,
        type: 'number',
      });

      await put(context.get().app, `/api/settings/${SETTING_KEYS.SCAN_MAX_DEPTH}`, {
        value: null,
        type: 'number',
      });

      const readBack = await get(context.get().app, `/api/settings/${SETTING_KEYS.SCAN_MAX_DEPTH}`);
      expect(asSetting(readBack.data).value).toBe('5');
    });

    // useQueries sends `type: undefined` when a caller omits it, and
    // JSON.stringify drops the key -- so the request reaches the route with no
    // type at all and used to be stored via auto-detect without validation.
    it('rejects a null value even when the request omits the type', async () => {
      const response = await put(
        context.get().app,
        `/api/settings/${SETTING_KEYS.SCAN_MAX_DEPTH}`,
        {
          value: null,
        }
      );

      expect(response.status).toBe(400);
    });

    it('leaves a valid stored depth readable as a number after a rejected write', async () => {
      await put(context.get().app, `/api/settings/${SETTING_KEYS.SCAN_MAX_DEPTH}`, {
        value: 6,
        type: 'number',
      });

      await put(context.get().app, `/api/settings/${SETTING_KEYS.SCAN_MAX_DEPTH}`, {
        value: null,
      });

      const readBack = await get(context.get().app, `/api/settings/${SETTING_KEYS.SCAN_MAX_DEPTH}`);
      expect(asSetting(readBack.data).value).toBe('6');
      expect((asSetting(readBack.data) as unknown as { type: string }).type).toBe('number');
    });

    it('still accepts a valid depth', async () => {
      const response = await put(
        context.get().app,
        `/api/settings/${SETTING_KEYS.SCAN_MAX_DEPTH}`,
        {
          value: 4,
          type: 'number',
        }
      );

      expect(response.status).toBe(200);
      expect(asSetting(response.data).value).toBe('4');
    });
  });
});
