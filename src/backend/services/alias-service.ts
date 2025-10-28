import { aliases, aliasThemes, db } from '../../shared/database';
import type {
  Alias,
  AliasTheme,
  DetectedAlias,
  PresetPack,
  ShellInfo,
} from '../../shared/types/api';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { asc, eq } from 'drizzle-orm';

const BARNACLES_MARKER_START = '# >>> barnacles aliases >>>';
const BARNACLES_MARKER_END = '# <<< barnacles aliases <<<';
const BARNACLES_SOURCE_LINE = 'source ~/.config/barnacles/aliases';

/**
 * Detect the current shell and relevant profile paths
 */
export async function detectShell(): Promise<ShellInfo> {
  const homeDir = os.homedir();
  const configPath = path.join(homeDir, '.config', 'barnacles', 'aliases');

  // Detect shell from user's default shell
  const shellEnv = os.userInfo().shell || '';
  let shell: ShellInfo['shell'] = 'unknown';
  let profilePaths: string[] = [];

  if (shellEnv.includes('zsh')) {
    shell = 'zsh';
    profilePaths = [path.join(homeDir, '.zshrc'), path.join(homeDir, '.zprofile')];
  } else if (shellEnv.includes('bash')) {
    shell = 'bash';
    profilePaths = [
      path.join(homeDir, '.bashrc'),
      path.join(homeDir, '.bash_profile'),
      path.join(homeDir, '.profile'),
    ];
  } else if (shellEnv.includes('fish')) {
    shell = 'fish';
    profilePaths = [path.join(homeDir, '.config', 'fish', 'config.fish')];
  }

  // Filter to only existing files
  const existingPaths: string[] = [];
  for (const profilePath of profilePaths) {
    try {
      await fs.access(profilePath);
      existingPaths.push(profilePath);
    } catch {
      // File doesn't exist, skip
    }
  }

  return {
    shell,
    profilePaths: existingPaths,
    configPath,
  };
}

/**
 * Parse aliases from shell profile files
 */
export async function detectAliasesFromProfiles(): Promise<DetectedAlias[]> {
  const shellInfo = await detectShell();
  const detectedAliases: DetectedAlias[] = [];
  const existingAliases = await db.select().from(aliases);
  const existingNames = new Set(existingAliases.map(a => a.name));

  for (const profilePath of shellInfo.profilePaths) {
    try {
      const content = await fs.readFile(profilePath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip comments and empty lines
        if (!line || line.startsWith('#')) continue;

        // Match alias definitions: alias name='command' or alias name="command"
        const aliasMatch = line.match(/^alias\s+([a-zA-Z0-9_-]+)=['"](.+)['"]$/);
        if (aliasMatch) {
          const [, name, command] = aliasMatch;
          detectedAliases.push({
            name,
            command,
            sourcePath: profilePath,
            lineNumber: i + 1,
            hasConflict: existingNames.has(name),
          });
        }
      }
    } catch (error) {
      console.error(`Failed to read ${profilePath}:`, error);
    }
  }

  return detectedAliases;
}

/**
 * Parse aliases from the barnacles config file
 */
async function parseAliasesFromConfigFile(): Promise<
  Array<{ name: string; command: string; description: string | null; category: string }>
> {
  const shellInfo = await detectShell();
  const parsedAliases: Array<{
    name: string;
    command: string;
    description: string | null;
    category: string;
  }> = [];

  try {
    const content = await fs.readFile(shellInfo.configPath, 'utf-8');
    const lines = content.split('\n');
    let currentCategory = 'custom';
    let currentDescription: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Skip header and empty lines
      if (!line || line.startsWith('#!/') || line.startsWith('# Barnacles') || line === '#') {
        continue;
      }

      // Detect category from section headers (e.g., "# Git Aliases")
      if (line.match(/^# (Git|Docker|System|Custom) Aliases$/)) {
        const match = line.match(/^# (Git|Docker|System|Custom) Aliases$/);
        if (match) {
          currentCategory = match[1].toLowerCase();
        }
        continue;
      }

      // Capture description comments
      if (line.startsWith('#') && !line.includes('>>>') && !line.includes('<<<')) {
        currentDescription = line.substring(1).trim();
        continue;
      }

      // Match alias definitions
      const aliasMatch = line.match(/^alias\s+([a-zA-Z0-9_-]+)='(.+)'$/);
      if (aliasMatch) {
        const [, name, fullCommand] = aliasMatch;

        // Extract the actual command (strip echo statements if present)
        let command = fullCommand;
        const echoMatch = fullCommand.match(/echo -e ".*?" && (.+)$/);
        if (echoMatch) {
          command = echoMatch[1];
        }

        parsedAliases.push({
          name,
          command,
          description: currentDescription,
          category: currentCategory,
        });

        // Reset description for next alias
        currentDescription = null;
      }
    }
  } catch {
    // File doesn't exist or can't be read, return empty array
    console.log('Config file does not exist or cannot be read:', shellInfo.configPath);
  }

  return parsedAliases;
}

/**
 * Sync aliases from config file to database if database is empty
 */
async function syncFromConfigFileIfEmpty(): Promise<void> {
  const existingAliases = await db.select().from(aliases);

  // Only sync if database is empty
  if (existingAliases.length === 0) {
    console.log('Database is empty, checking for config file...');
    const parsedAliases = await parseAliasesFromConfigFile();

    if (parsedAliases.length > 0) {
      console.log(`Found ${parsedAliases.length} aliases in config file, syncing to database...`);

      for (let i = 0; i < parsedAliases.length; i++) {
        const alias = parsedAliases[i];
        await createAlias({
          name: alias.name,
          command: alias.command,
          description: alias.description,
          color: null,
          showCommand: true,
          category: alias.category as Alias['category'],
          order: i,
        });
      }

      console.log(
        `✅ Successfully synced ${parsedAliases.length} aliases from config file to database`
      );
    }
  }
}

/**
 * Get all aliases from the database
 */
export async function getAllAliases(): Promise<Alias[]> {
  // Check if we need to sync from config file first
  await syncFromConfigFileIfEmpty();

  const results = await db.select().from(aliases).orderBy(asc(aliases.order), asc(aliases.name));
  return results.map(row => ({
    ...row,
    category: row.category as Alias['category'],
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  }));
}

/**
 * Get an alias by name
 */
export async function getAliasByName(name: string): Promise<Alias | undefined> {
  const [result] = await db.select().from(aliases).where(eq(aliases.name, name)).limit(1);
  if (!result) return undefined;
  return {
    ...result,
    category: result.category as Alias['category'],
    createdAt: new Date(result.createdAt),
    updatedAt: new Date(result.updatedAt),
  };
}

/**
 * Create a new alias
 */
export async function createAlias(
  data: Omit<Alias, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Alias> {
  const [result] = await db.insert(aliases).values(data).returning();
  return {
    ...result,
    category: result.category as Alias['category'],
    createdAt: new Date(result.createdAt),
    updatedAt: new Date(result.updatedAt),
  };
}

/**
 * Update an existing alias
 */
export async function updateAlias(
  id: string,
  data: Partial<Omit<Alias, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<Alias> {
  const [result] = await db
    .update(aliases)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(aliases.id, id))
    .returning();

  return {
    ...result,
    category: result.category as Alias['category'],
    createdAt: new Date(result.createdAt),
    updatedAt: new Date(result.updatedAt),
  };
}

/**
 * Delete an alias
 */
export async function deleteAlias(id: string): Promise<void> {
  await db.delete(aliases).where(eq(aliases.id, id));
}

/**
 * Get all themes
 */
export async function getAllThemes(): Promise<AliasTheme[]> {
  const results = await db.select().from(aliasThemes);
  return results.map(row => ({
    ...row,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  }));
}

/**
 * Get the active theme
 */
export async function getActiveTheme(): Promise<AliasTheme | null> {
  const [result] = await db
    .select()
    .from(aliasThemes)
    .where(eq(aliasThemes.isActive, true))
    .limit(1);
  if (!result) return null;

  return {
    ...result,
    createdAt: new Date(result.createdAt),
    updatedAt: new Date(result.updatedAt),
  };
}

/**
 * Generate the ANSI color code for an alias
 */
function getColorCode(alias: Alias, theme: AliasTheme | null): string {
  // If alias has custom color, use it
  if (alias.color) {
    return alias.color;
  }

  // Use theme color based on category
  if (theme) {
    switch (alias.category) {
      case 'git':
        return theme.gitColor;
      case 'docker':
        return theme.dockerColor;
      case 'system':
        return theme.systemColor;
      case 'custom':
      default:
        return theme.customColor;
    }
  }

  // Default colors if no theme
  switch (alias.category) {
    case 'git':
      return '32'; // green
    case 'docker':
      return '34'; // blue
    case 'system':
      return '33'; // yellow
    case 'custom':
    default:
      return '36'; // cyan
  }
}

/**
 * Generate the ~/.config/barnacles/aliases file content
 */
async function generateAliasFileContent(): Promise<string> {
  const allAliases = await getAllAliases();
  const theme = await getActiveTheme();

  let content = '#!/bin/bash\n';
  content += '# Barnacles Aliases\n';
  content += '# This file is auto-generated. Do not edit manually.\n';
  content += '# Manage your aliases at: barnacles://aliases\n\n';

  // Group aliases by category
  const grouped: Record<string, Alias[]> = {
    git: [],
    docker: [],
    system: [],
    custom: [],
  };

  for (const alias of allAliases) {
    grouped[alias.category].push(alias);
  }

  // Generate aliases for each category
  for (const [category, categoryAliases] of Object.entries(grouped)) {
    if (categoryAliases.length === 0) continue;

    content += `# ${category.charAt(0).toUpperCase() + category.slice(1)} Aliases\n`;

    for (const alias of categoryAliases) {
      const colorCode = getColorCode(alias, theme);

      if (alias.description) {
        content += `# ${alias.description}\n`;
      }

      if (alias.showCommand) {
        // Echo the command in color before executing
        content += `alias ${alias.name}='echo -e "\\033[${colorCode}m▸ ${alias.command}\\033[0m" && ${alias.command}'\n`;
      } else {
        content += `alias ${alias.name}='${alias.command}'\n`;
      }
    }

    content += '\n';
  }

  return content;
}

/**
 * Ensure the barnacles config directory exists
 */
async function ensureConfigDirectory(): Promise<string> {
  const homeDir = os.homedir();
  const configDir = path.join(homeDir, '.config', 'barnacles');

  try {
    await fs.mkdir(configDir, { recursive: true });
  } catch (error) {
    console.error('Failed to create config directory:', error);
  }

  return configDir;
}

/**
 * Generate and write the aliases file
 */
export async function generateAliasFile(): Promise<string> {
  await ensureConfigDirectory();
  const shellInfo = await detectShell();
  const content = await generateAliasFileContent();

  await fs.writeFile(shellInfo.configPath, content, 'utf-8');

  return shellInfo.configPath;
}

/**
 * Check if a profile already sources barnacles aliases
 */
async function profileHasBarnaclesSource(profilePath: string): Promise<boolean> {
  try {
    const content = await fs.readFile(profilePath, 'utf-8');
    return content.includes(BARNACLES_SOURCE_LINE);
  } catch {
    return false;
  }
}

/**
 * Add source line to shell profile
 */
async function addSourceToProfile(profilePath: string): Promise<void> {
  const hasSource = await profileHasBarnaclesSource(profilePath);
  if (hasSource) return;

  try {
    let content = await fs.readFile(profilePath, 'utf-8');

    // Add a newline if file doesn't end with one
    if (!content.endsWith('\n')) {
      content += '\n';
    }

    content += `\n${BARNACLES_MARKER_START}\n`;
    content += `${BARNACLES_SOURCE_LINE}\n`;
    content += `${BARNACLES_MARKER_END}\n`;

    await fs.writeFile(profilePath, content, 'utf-8');
  } catch (error) {
    console.error(`Failed to update profile ${profilePath}:`, error);
    throw error;
  }
}

/**
 * Comment out conflicting aliases in shell profiles
 */
async function commentOutConflictingAliases(
  profilePath: string,
  aliasNames: Set<string>
): Promise<void> {
  try {
    const content = await fs.readFile(profilePath, 'utf-8');
    const lines = content.split('\n');
    const modifiedLines: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Check if line defines an alias that conflicts
      const aliasMatch = trimmed.match(/^alias\s+([a-zA-Z0-9_-]+)=/);
      if (aliasMatch) {
        const [, name] = aliasMatch;
        if (aliasNames.has(name)) {
          // Comment it out with a marker
          modifiedLines.push(`# [barnacles-disabled] ${line}`);
          continue;
        }
      }

      modifiedLines.push(line);
    }

    await fs.writeFile(profilePath, modifiedLines.join('\n'), 'utf-8');
  } catch (error) {
    console.error(`Failed to comment out aliases in ${profilePath}:`, error);
  }
}

/**
 * Sync aliases: generate file and update shell profiles
 */
export async function syncAliases(): Promise<{ configPath: string; updatedProfiles: string[] }> {
  // Generate the alias file
  const configPath = await generateAliasFile();

  // Get all alias names to check for conflicts
  const allAliases = await getAllAliases();
  const aliasNames = new Set(allAliases.map(a => a.name));

  // Update shell profiles
  const shellInfo = await detectShell();
  const updatedProfiles: string[] = [];

  for (const profilePath of shellInfo.profilePaths) {
    try {
      // Add source line if not present
      await addSourceToProfile(profilePath);

      // Comment out conflicting aliases
      await commentOutConflictingAliases(profilePath, aliasNames);

      updatedProfiles.push(profilePath);
    } catch (error) {
      console.error(`Failed to update profile ${profilePath}:`, error);
    }
  }

  return { configPath, updatedProfiles };
}

/**
 * Import aliases from detected profiles
 */
export async function importDetectedAliases(
  aliasesToImport: Array<{ name: string; command: string; category?: string }>
): Promise<Alias[]> {
  const imported: Alias[] = [];
  let maxOrder = 0;

  // Get current max order
  const existing = await getAllAliases();
  if (existing.length > 0) {
    maxOrder = Math.max(...existing.map(a => a.order));
  }

  for (const { name, command, category = 'custom' } of aliasesToImport) {
    maxOrder++;
    const alias = await createAlias({
      name,
      command,
      description: null,
      color: null,
      showCommand: false,
      category: category as Alias['category'],
      order: maxOrder,
    });
    imported.push(alias);
  }

  return imported;
}

/**
 * Get preset alias packs
 */
export function getPresetPacks(): PresetPack[] {
  return [
    {
      id: 'git-essentials',
      name: 'Git Essentials',
      description: 'Common git shortcuts for everyday use',
      category: 'git',
      icon: '🌿',
      aliases: [
        { name: 'g', command: 'git', description: 'Short for git' },
        { name: 'gs', command: 'git status', description: 'Show git status' },
        { name: 'gco', command: 'git checkout', description: 'Checkout branch' },
        { name: 'gcb', command: 'git checkout -b', description: 'Create and checkout new branch' },
        { name: 'gp', command: 'git pull', description: 'Pull changes' },
        { name: 'gpu', command: 'git push', description: 'Push changes' },
        { name: 'ga', command: 'git add', description: 'Add files to staging' },
        { name: 'gaa', command: 'git add --all', description: 'Add all files to staging' },
        { name: 'gc', command: 'git commit', description: 'Commit changes' },
        { name: 'gcm', command: 'git commit -m', description: 'Commit with message' },
        { name: 'gd', command: 'git diff', description: 'Show changes' },
        {
          name: 'gl',
          command: 'git log --oneline --graph --decorate',
          description: 'Pretty git log',
        },
        { name: 'gf', command: 'git fetch', description: 'Fetch from remote' },
        { name: 'gb', command: 'git branch', description: 'List branches' },
        { name: 'gbd', command: 'git branch -d', description: 'Delete branch' },
      ],
    },
    {
      id: 'docker-basics',
      name: 'Docker Basics',
      description: 'Useful shortcuts for Docker commands',
      category: 'docker',
      icon: '🐳',
      aliases: [
        { name: 'd', command: 'docker', description: 'Short for docker' },
        { name: 'dps', command: 'docker ps', description: 'List running containers' },
        { name: 'dpsa', command: 'docker ps -a', description: 'List all containers' },
        { name: 'di', command: 'docker images', description: 'List images' },
        { name: 'dex', command: 'docker exec -it', description: 'Execute command in container' },
        { name: 'dlog', command: 'docker logs -f', description: 'Follow container logs' },
        { name: 'dstop', command: 'docker stop', description: 'Stop container' },
        { name: 'drm', command: 'docker rm', description: 'Remove container' },
        { name: 'drmi', command: 'docker rmi', description: 'Remove image' },
        { name: 'dc', command: 'docker-compose', description: 'Short for docker-compose' },
        {
          name: 'dcu',
          command: 'docker-compose up -d',
          description: 'Start containers in background',
        },
        { name: 'dcd', command: 'docker-compose down', description: 'Stop and remove containers' },
        { name: 'dcl', command: 'docker-compose logs -f', description: 'Follow compose logs' },
      ],
    },
    {
      id: 'system-tools',
      name: 'System Tools',
      description: 'Handy system and file management aliases',
      category: 'system',
      icon: '⚙️',
      aliases: [
        { name: 'b', command: 'barnacles', description: 'Shorten the barnacles CLI command' },
        {
          name: 'aliases',
          command: 'barnacles aliases',
          description: 'List all aliases managed by Barnacles',
        },
        { name: 'la', command: 'ls -A', description: 'List all files including hidden' },
        { name: 'cls', command: 'clear', description: 'Clear terminal screen' },
        { name: 'md', command: 'mkdir -p', description: 'Make directory with parents' },
        { name: 'rd', command: 'rmdir', description: 'Remove directory' },
        { name: 'grep', command: 'grep --color=auto', description: 'Grep with color' },
        {
          name: 'ports',
          command: 'lsof -i -P | grep LISTEN',
          description: 'Show all listening ports',
        },
        { name: 'reload', command: 'exec $SHELL -l', description: 'Reload shell configuration' },
      ],
    },
  ];
}

/**
 * Install preset pack aliases
 */
export async function installPresetPack(
  packId: string,
  selectedAliasNames: string[]
): Promise<Alias[]> {
  const packs = getPresetPacks();
  const pack = packs.find(p => p.id === packId);

  if (!pack) {
    throw new Error(`Preset pack not found: ${packId}`);
  }

  const aliasesToInstall = pack.aliases.filter(a => selectedAliasNames.includes(a.name));
  const imported: Alias[] = [];
  let maxOrder = 0;

  // Get existing aliases
  const existing = await getAllAliases();
  const existingNames = new Set(existing.map(a => a.name));

  if (existing.length > 0) {
    maxOrder = Math.max(...existing.map(a => a.order));
  }

  for (const presetAlias of aliasesToInstall) {
    // Skip if alias with this name already exists
    if (existingNames.has(presetAlias.name)) {
      console.log(`Skipping duplicate alias: ${presetAlias.name}`);
      continue;
    }

    maxOrder++;
    const alias = await createAlias({
      name: presetAlias.name,
      command: presetAlias.command,
      description: presetAlias.description,
      color: null,
      showCommand: true,
      category: pack.category,
      order: maxOrder,
    });
    imported.push(alias);
  }

  return imported;
}
