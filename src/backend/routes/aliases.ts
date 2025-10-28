import { Hono } from 'hono';
import * as aliasService from '../services/alias-service';

const aliases = new Hono();

/**
 * GET /api/aliases
 * Get all aliases
 */
aliases.get('/', async c => {
  try {
    const data = await aliasService.getAllAliases();
    return c.json({ data });
  } catch (error) {
    console.error('Error fetching aliases:', error);
    return c.json({ error: 'Failed to fetch aliases' }, 500);
  }
});

/**
 * GET /api/aliases/config-path
 * Get the path to the barnacles aliases file
 */
aliases.get('/config-path', async c => {
  try {
    const shellInfo = await aliasService.detectShell();
    return c.json({
      data: {
        path: shellInfo.configPath,
        shell: shellInfo.shell,
        profilePaths: shellInfo.profilePaths,
      },
    });
  } catch (error) {
    console.error('Error detecting shell:', error);
    return c.json({ error: 'Failed to detect shell configuration' }, 500);
  }
});

/**
 * GET /api/aliases/detect
 * Detect existing aliases from shell profiles
 */
aliases.get('/detect', async c => {
  try {
    const data = await aliasService.detectAliasesFromProfiles();
    return c.json({ data });
  } catch (error) {
    console.error('Error detecting aliases:', error);
    return c.json({ error: 'Failed to detect aliases from profiles' }, 500);
  }
});

/**
 * POST /api/aliases/import
 * Import aliases from shell profiles
 */
aliases.post('/import', async c => {
  try {
    const body = await c.req.json();
    const { aliases: aliasesToImport } = body;

    if (!Array.isArray(aliasesToImport)) {
      return c.json({ error: 'Invalid request: aliases must be an array' }, 400);
    }

    const data = await aliasService.importDetectedAliases(aliasesToImport);
    return c.json({ data, message: 'Aliases imported successfully' });
  } catch (error) {
    console.error('Error importing aliases:', error);
    return c.json({ error: 'Failed to import aliases' }, 500);
  }
});

/**
 * GET /api/aliases/presets
 * Get available preset alias packs
 */
aliases.get('/presets', async c => {
  try {
    const data = aliasService.getPresetPacks();
    return c.json({ data });
  } catch (error) {
    console.error('Error fetching preset packs:', error);
    return c.json({ error: 'Failed to fetch preset packs' }, 500);
  }
});

/**
 * POST /api/aliases/presets/install
 * Install selected aliases from a preset pack
 */
aliases.post('/presets/install', async c => {
  try {
    const body = await c.req.json();
    const { packId, aliasNames } = body;

    if (!packId || !Array.isArray(aliasNames)) {
      return c.json({ error: 'Invalid request: packId and aliasNames are required' }, 400);
    }

    const data = await aliasService.installPresetPack(packId, aliasNames);
    return c.json({ data, message: 'Preset aliases installed successfully' });
  } catch (error) {
    console.error('Error installing preset pack:', error);
    const message = error instanceof Error ? error.message : 'Failed to install preset pack';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /api/aliases/themes
 * Get all alias themes
 */
aliases.get('/themes', async c => {
  try {
    const data = await aliasService.getAllThemes();
    return c.json({ data });
  } catch (error) {
    console.error('Error fetching themes:', error);
    return c.json({ error: 'Failed to fetch themes' }, 500);
  }
});

/**
 * POST /api/aliases/sync
 * Generate alias file and update shell profiles
 */
aliases.post('/sync', async c => {
  try {
    const data = await aliasService.syncAliases();
    return c.json({
      data,
      message:
        'Aliases synced successfully. Please restart your terminal for changes to take effect.',
    });
  } catch (error) {
    console.error('Error syncing aliases:', error);
    return c.json({ error: 'Failed to sync aliases' }, 500);
  }
});

/**
 * POST /api/aliases
 * Create a new alias
 */
aliases.post('/', async c => {
  try {
    const body = await c.req.json();
    const { name, command, description, color, showCommand, category, order } = body;

    if (!name || !command) {
      return c.json({ error: 'Invalid request: name and command are required' }, 400);
    }

    // Validate alias name (no spaces, alphanumeric + underscore/hyphen)
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return c.json(
        { error: 'Invalid alias name: only letters, numbers, underscores, and hyphens allowed' },
        400
      );
    }

    // Check for duplicate alias name
    const existing = await aliasService.getAliasByName(name);
    if (existing) {
      return c.json({ error: `An alias with the name "${name}" already exists` }, 409);
    }

    const data = await aliasService.createAlias({
      name,
      command,
      description: description || null,
      color: color || null,
      showCommand: showCommand !== undefined ? showCommand : true,
      category: category || 'custom',
      order: order || 0,
    });

    return c.json({ data, message: 'Alias created successfully' });
  } catch (error) {
    console.error('Error creating alias:', error);
    return c.json({ error: 'Failed to create alias' }, 500);
  }
});

/**
 * PUT /api/aliases/:id
 * Update an existing alias
 */
aliases.put('/:id', async c => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const { name, command, description, color, showCommand, category, order } = body;

    // Validate alias name if provided
    if (name && !/^[a-zA-Z0-9_-]+$/.test(name)) {
      return c.json(
        { error: 'Invalid alias name: only letters, numbers, underscores, and hyphens allowed' },
        400
      );
    }

    // If updating name, check for duplicate alias name (excluding current alias)
    if (name) {
      const existing = await aliasService.getAliasByName(name);
      if (existing && existing.id !== id) {
        return c.json({ error: `An alias with the name "${name}" already exists` }, 409);
      }
    }

    const data = await aliasService.updateAlias(id, {
      ...(name && { name }),
      ...(command && { command }),
      ...(description !== undefined && { description }),
      ...(color !== undefined && { color }),
      ...(showCommand !== undefined && { showCommand }),
      ...(category && { category }),
      ...(order !== undefined && { order }),
    });

    return c.json({ data, message: 'Alias updated successfully' });
  } catch (error) {
    console.error('Error updating alias:', error);
    return c.json({ error: 'Failed to update alias' }, 500);
  }
});

/**
 * DELETE /api/aliases/:id
 * Delete an alias
 */
aliases.delete('/:id', async c => {
  try {
    const id = c.req.param('id');
    await aliasService.deleteAlias(id);
    return c.json({ message: 'Alias deleted successfully' });
  } catch (error) {
    console.error('Error deleting alias:', error);
    return c.json({ error: 'Failed to delete alias' }, 500);
  }
});

export default aliases;
