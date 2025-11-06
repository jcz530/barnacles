import { Hono } from 'hono';
import { themeService } from '../services/theme-service';

const themes = new Hono();

/**
 * GET /api/themes
 * Get all themes
 */
themes.get('/', async c => {
  try {
    const allThemes = await themeService.getAllThemes();

    return c.json({
      data: allThemes,
    });
  } catch (error) {
    console.error('Error fetching themes:', error);
    return c.json(
      {
        error: 'Failed to fetch themes',
      },
      500
    );
  }
});

/**
 * GET /api/themes/active
 * Get the currently active theme
 */
themes.get('/active', async c => {
  try {
    const activeTheme = await themeService.getActiveTheme();

    if (!activeTheme) {
      return c.json(
        {
          error: 'No active theme found',
        },
        404
      );
    }

    return c.json({
      data: activeTheme,
    });
  } catch (error) {
    console.error('Error fetching active theme:', error);
    return c.json(
      {
        error: 'Failed to fetch active theme',
      },
      500
    );
  }
});

/**
 * GET /api/themes/:id
 * Get a single theme by ID
 */
themes.get('/:id', async c => {
  try {
    const id = c.req.param('id');
    const theme = await themeService.getTheme(id);

    if (!theme) {
      return c.json(
        {
          error: 'Theme not found',
        },
        404
      );
    }

    return c.json({
      data: theme,
    });
  } catch (error) {
    console.error('Error fetching theme:', error);
    return c.json(
      {
        error: 'Failed to fetch theme',
      },
      500
    );
  }
});

/**
 * POST /api/themes
 * Create a new theme
 */
themes.post('/', async c => {
  try {
    const body = await c.req.json();
    const {
      name,
      primaryColor,
      secondaryColor,
      tertiaryColor,
      slateColor,
      successColor,
      dangerColor,
      fontUi,
      fontHeading,
      fontCode,
      borderRadius,
      customCssVars,
    } = body;

    if (!name) {
      return c.json(
        {
          error: 'Name is required',
        },
        400
      );
    }

    const theme = await themeService.createTheme({
      name,
      primaryColor,
      secondaryColor,
      tertiaryColor,
      slateColor,
      successColor,
      dangerColor,
      fontUi,
      fontHeading,
      fontCode,
      borderRadius,
      customCssVars,
    });

    return c.json(
      {
        data: theme,
        message: 'Theme created successfully',
      },
      201
    );
  } catch (error) {
    console.error('Error creating theme:', error);
    return c.json(
      {
        error: 'Failed to create theme',
      },
      500
    );
  }
});

/**
 * PUT /api/themes/:id
 * Update a theme
 */
themes.put('/:id', async c => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const {
      name,
      primaryColor,
      secondaryColor,
      tertiaryColor,
      slateColor,
      successColor,
      dangerColor,
      fontUi,
      fontHeading,
      fontCode,
      borderRadius,
      customCssVars,
    } = body;

    const theme = await themeService.updateTheme(id, {
      name,
      primaryColor,
      secondaryColor,
      tertiaryColor,
      slateColor,
      successColor,
      dangerColor,
      fontUi,
      fontHeading,
      fontCode,
      borderRadius,
      customCssVars,
    });

    if (!theme) {
      return c.json(
        {
          error: 'Theme not found',
        },
        404
      );
    }

    return c.json({
      data: theme,
      message: 'Theme updated successfully',
    });
  } catch (error) {
    console.error('Error updating theme:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update theme';
    return c.json(
      {
        error: errorMessage,
      },
      500
    );
  }
});

/**
 * DELETE /api/themes/:id
 * Delete a theme
 */
themes.delete('/:id', async c => {
  try {
    const id = c.req.param('id');
    const success = await themeService.deleteTheme(id);

    if (!success) {
      return c.json(
        {
          error: 'Theme not found',
        },
        404
      );
    }

    return c.json({
      message: 'Theme deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting theme:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete theme';
    return c.json(
      {
        error: errorMessage,
      },
      500
    );
  }
});

/**
 * POST /api/themes/:id/activate
 * Activate a theme
 */
themes.post('/:id/activate', async c => {
  try {
    const id = c.req.param('id');
    const theme = await themeService.activateTheme(id);

    if (!theme) {
      return c.json(
        {
          error: 'Theme not found',
        },
        404
      );
    }

    return c.json({
      data: theme,
      message: 'Theme activated successfully',
    });
  } catch (error) {
    console.error('Error activating theme:', error);
    return c.json(
      {
        error: 'Failed to activate theme',
      },
      500
    );
  }
});

/**
 * POST /api/themes/:id/duplicate
 * Duplicate a theme
 */
themes.post('/:id/duplicate', async c => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const { name } = body;

    const theme = await themeService.duplicateTheme(id, name);

    if (!theme) {
      return c.json(
        {
          error: 'Theme not found',
        },
        404
      );
    }

    return c.json(
      {
        data: theme,
        message: 'Theme duplicated successfully',
      },
      201
    );
  } catch (error) {
    console.error('Error duplicating theme:', error);
    return c.json(
      {
        error: 'Failed to duplicate theme',
      },
      500
    );
  }
});

/**
 * POST /api/themes/:id/reset
 * Reset a default theme to its original values
 */
themes.post('/:id/reset', async c => {
  try {
    const id = c.req.param('id');
    const theme = await themeService.resetTheme(id);

    if (!theme) {
      return c.json(
        {
          error: 'Theme not found or is not a default theme',
        },
        404
      );
    }

    return c.json({
      data: theme,
      message: 'Theme reset successfully',
    });
  } catch (error) {
    console.error('Error resetting theme:', error);
    return c.json(
      {
        error: 'Failed to reset theme',
      },
      500
    );
  }
});

/**
 * POST /api/themes/initialize
 * Initialize default themes (useful for first run or after database reset)
 */
themes.post('/initialize', async c => {
  try {
    await themeService.initializeDefaultThemes();

    return c.json({
      message: 'Default themes initialized successfully',
    });
  } catch (error) {
    console.error('Error initializing themes:', error);
    return c.json(
      {
        error: 'Failed to initialize themes',
      },
      500
    );
  }
});

export default themes;
