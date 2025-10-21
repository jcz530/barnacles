import { Hono } from 'hono';
import { settingsService } from '../services/settings-service';
import { toggleTrayIcon, toggleCliInstallation } from '../../main/main';

const settings = new Hono();

/**
 * GET /api/settings
 * Get all settings
 */
settings.get('/', async c => {
  try {
    const allSettings = await settingsService.getAllSettings();

    return c.json({
      data: allSettings,
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    return c.json(
      {
        error: 'Failed to fetch settings',
      },
      500
    );
  }
});

/**
 * GET /api/settings/:key
 * Get a single setting by key
 */
settings.get('/:key', async c => {
  try {
    const key = c.req.param('key');
    const setting = await settingsService.getSetting(key);

    if (!setting) {
      return c.json(
        {
          error: 'Setting not found',
        },
        404
      );
    }

    return c.json({
      data: setting,
    });
  } catch (error) {
    console.error('Error fetching setting:', error);
    return c.json(
      {
        error: 'Failed to fetch setting',
      },
      500
    );
  }
});

/**
 * PUT /api/settings/:key
 * Update or create a setting
 */
settings.put('/:key', async c => {
  try {
    const key = c.req.param('key');
    const body = await c.req.json();
    const { value, type } = body;

    if (value === undefined) {
      return c.json(
        {
          error: 'Value is required',
        },
        400
      );
    }

    const setting = await settingsService.setSetting(key, value, type);

    // Handle special cases for settings that trigger system changes
    if (key === 'showTrayIcon') {
      const boolValue = value === true || value === 'true' || value === 1;
      await toggleTrayIcon(boolValue);
    }

    if (key === 'installCliCommand') {
      const boolValue = value === true || value === 'true' || value === 1;
      await toggleCliInstallation(boolValue);
    }

    return c.json({
      data: setting,
      message: 'Setting updated successfully',
    });
  } catch (error) {
    console.error('Error updating setting:', error);
    return c.json(
      {
        error: 'Failed to update setting',
      },
      500
    );
  }
});

/**
 * DELETE /api/settings/:key
 * Delete a setting
 */
settings.delete('/:key', async c => {
  try {
    const key = c.req.param('key');
    await settingsService.deleteSetting(key);

    return c.json({
      message: 'Setting deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting setting:', error);
    return c.json(
      {
        error: 'Failed to delete setting',
      },
      500
    );
  }
});

/**
 * POST /api/settings/reset
 * Reset all settings to defaults
 */
settings.post('/reset', async c => {
  try {
    await settingsService.resetToDefaults();

    return c.json({
      message: 'Settings reset to defaults',
    });
  } catch (error) {
    console.error('Error resetting settings:', error);
    return c.json(
      {
        error: 'Failed to reset settings',
      },
      500
    );
  }
});

/**
 * GET /api/settings/defaults
 * Get all default settings
 */
settings.get('/defaults', async c => {
  try {
    const defaults = settingsService.getDefaultSettings();

    return c.json({
      data: defaults,
    });
  } catch (error) {
    console.error('Error fetching default settings:', error);
    return c.json(
      {
        error: 'Failed to fetch default settings',
      },
      500
    );
  }
});

/**
 * GET /api/settings/defaults/:key
 * Get default value for a specific setting
 */
settings.get('/defaults/:key', async c => {
  try {
    const key = c.req.param('key');
    const defaultValue = settingsService.getDefaultValue(key);

    if (defaultValue === null) {
      return c.json(
        {
          error: 'Default setting not found',
        },
        404
      );
    }

    return c.json({
      data: defaultValue,
    });
  } catch (error) {
    console.error('Error fetching default setting:', error);
    return c.json(
      {
        error: 'Failed to fetch default setting',
      },
      500
    );
  }
});

export default settings;
