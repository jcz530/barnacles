import { Hono } from 'hono';
import * as aliasService from '../services/alias-service';
import { loadAlias, type AliasContext } from '../middleware/alias-loader';
import { BadRequestException } from '../exceptions/http-exceptions';

const aliases = new Hono();

/**
 * GET /api/aliases
 * Get all aliases
 */
aliases.get('/', async c => {
  const data = await aliasService.getAllAliases();
  return c.json({ data });
});

/**
 * GET /api/aliases/config-path
 * Get the path to the barnacles aliases file
 */
aliases.get('/config-path', async c => {
  const shellInfo = await aliasService.detectShell();
  return c.json({
    data: {
      path: shellInfo.configPath,
      shell: shellInfo.shell,
      profilePaths: shellInfo.profilePaths,
    },
  });
});

/**
 * GET /api/aliases/detect
 * Detect existing aliases from shell profiles
 */
aliases.get('/detect', async c => {
  const data = await aliasService.detectAliasesFromProfiles();
  return c.json({ data });
});

/**
 * POST /api/aliases/import
 * Import aliases from shell profiles
 */
aliases.post('/import', async c => {
  const body = await c.req.json();
  const { aliases: aliasesToImport } = body;

  if (!Array.isArray(aliasesToImport)) {
    throw new BadRequestException('Invalid request: aliases must be an array');
  }

  const data = await aliasService.importDetectedAliases(aliasesToImport);
  return c.json({ data, message: 'Aliases imported successfully' });
});

/**
 * GET /api/aliases/presets
 * Get available preset alias packs
 */
aliases.get('/presets', async c => {
  const data = aliasService.getPresetPacks();
  return c.json({ data });
});

/**
 * POST /api/aliases/presets/install
 * Install selected aliases from a preset pack
 */
aliases.post('/presets/install', async c => {
  const body = await c.req.json();
  const { packId, aliasNames } = body;

  if (!packId || !Array.isArray(aliasNames)) {
    throw new BadRequestException('Invalid request: packId and aliasNames are required');
  }

  const data = await aliasService.installPresetPack(packId, aliasNames);
  return c.json({ data, message: 'Preset aliases installed successfully' });
});

/**
 * GET /api/aliases/themes
 * Get all alias themes
 */
aliases.get('/themes', async c => {
  const data = await aliasService.getAllThemes();
  return c.json({ data });
});

/**
 * POST /api/aliases/sync
 * Generate alias file and update shell profiles
 */
aliases.post('/sync', async c => {
  const data = await aliasService.syncAliases();
  return c.json({
    data,
    message:
      'Aliases synced successfully. Please restart your terminal for changes to take effect.',
  });
});

/**
 * POST /api/aliases
 * Create a new alias
 */
aliases.post('/', async c => {
  const body = await c.req.json();
  const { name, command, description, color, showCommand, category, order } = body;

  if (!name || !command) {
    throw new BadRequestException('Invalid request: name and command are required');
  }

  // Validate alias name (no spaces, alphanumeric + underscore/hyphen)
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new BadRequestException(
      'Invalid alias name: only letters, numbers, underscores, and hyphens allowed'
    );
  }

  // Check for duplicate alias name
  const existing = await aliasService.getAliasByName(name);
  if (existing) {
    throw new BadRequestException(`An alias with the name "${name}" already exists`);
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
});

/**
 * PUT /api/aliases/:id
 * Update an existing alias
 */
aliases.put('/:id', loadAlias, async (c: AliasContext) => {
  const alias = c.get('alias');
  const body = await c.req.json();
  const { name, command, description, color, showCommand, category, order } = body;

  // Validate alias name if provided
  if (name && !/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new BadRequestException(
      'Invalid alias name: only letters, numbers, underscores, and hyphens allowed'
    );
  }

  // If updating name, check for duplicate alias name (excluding current alias)
  if (name) {
    const existing = await aliasService.getAliasByName(name);
    if (existing && existing.id !== alias.id) {
      throw new BadRequestException(`An alias with the name "${name}" already exists`);
    }
  }

  const data = await aliasService.updateAlias(alias.id, {
    ...(name && { name }),
    ...(command && { command }),
    ...(description !== undefined && { description }),
    ...(color !== undefined && { color }),
    ...(showCommand !== undefined && { showCommand }),
    ...(category && { category }),
    ...(order !== undefined && { order }),
  });

  return c.json({ data, message: 'Alias updated successfully' });
});

/**
 * DELETE /api/aliases/:id
 * Delete an alias
 */
aliases.delete('/:id', loadAlias, async (c: AliasContext) => {
  const alias = c.get('alias');
  await aliasService.deleteAlias(alias.id);
  return c.json({ message: 'Alias deleted successfully' });
});

export default aliases;
