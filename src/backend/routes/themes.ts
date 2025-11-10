import { Hono } from 'hono';
import { themeService } from '../services/theme-service';
import { loadTheme, type ThemeContext } from '../middleware/theme-loader';
import { BadRequestException, NotFoundException } from '../exceptions/http-exceptions';

const themes = new Hono();

/**
 * GET /api/themes
 * Get all themes
 */
themes.get('/', async c => {
  const allThemes = await themeService.getAllThemes();

  return c.json({
    data: allThemes,
  });
});

/**
 * GET /api/themes/active
 * Get the currently active theme
 */
themes.get('/active', async c => {
  const activeTheme = await themeService.getActiveTheme();

  if (!activeTheme) {
    throw new NotFoundException('No active theme found');
  }

  return c.json({
    data: activeTheme,
  });
});

/**
 * GET /api/themes/:id
 * Get a single theme by ID
 */
themes.get('/:id', loadTheme, async (c: ThemeContext) => {
  const theme = c.get('theme');

  return c.json({
    data: theme,
  });
});

/**
 * POST /api/themes
 * Create a new theme
 */
themes.post('/', async c => {
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
    throw new BadRequestException('Name is required');
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
});

/**
 * PUT /api/themes/:id
 * Update a theme
 */
themes.put('/:id', loadTheme, async (c: ThemeContext) => {
  const theme = c.get('theme');
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

  const updatedTheme = await themeService.updateTheme(theme.id, {
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

  return c.json({
    data: updatedTheme,
    message: 'Theme updated successfully',
  });
});

/**
 * DELETE /api/themes/:id
 * Delete a theme
 */
themes.delete('/:id', loadTheme, async (c: ThemeContext) => {
  const theme = c.get('theme');
  await themeService.deleteTheme(theme.id);

  return c.json({
    message: 'Theme deleted successfully',
  });
});

/**
 * POST /api/themes/:id/activate
 * Activate a theme
 */
themes.post('/:id/activate', loadTheme, async (c: ThemeContext) => {
  const theme = c.get('theme');
  const activatedTheme = await themeService.activateTheme(theme.id);

  return c.json({
    data: activatedTheme,
    message: 'Theme activated successfully',
  });
});

/**
 * POST /api/themes/:id/duplicate
 * Duplicate a theme
 */
themes.post('/:id/duplicate', loadTheme, async (c: ThemeContext) => {
  const theme = c.get('theme');
  const body = await c.req.json().catch(() => ({}));
  const { name } = body;

  const duplicatedTheme = await themeService.duplicateTheme(theme.id, name);

  return c.json(
    {
      data: duplicatedTheme,
      message: 'Theme duplicated successfully',
    },
    201
  );
});

/**
 * POST /api/themes/:id/reset
 * Reset a default theme to its original values
 */
themes.post('/:id/reset', loadTheme, async (c: ThemeContext) => {
  const theme = c.get('theme');
  const resetTheme = await themeService.resetTheme(theme.id);

  if (!resetTheme) {
    throw new NotFoundException('Theme is not a default theme');
  }

  return c.json({
    data: resetTheme,
    message: 'Theme reset successfully',
  });
});

/**
 * POST /api/themes/initialize
 * Initialize default themes (useful for first run or after database reset)
 */
themes.post('/initialize', async c => {
  await themeService.initializeDefaultThemes();

  return c.json({
    message: 'Default themes initialized successfully',
  });
});

export default themes;
