import { db } from '../../shared/database/connection';
import { themes } from '../../shared/database/schema';
import { eq, desc } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import type { Theme, CreateThemeInput, UpdateThemeInput } from '../../shared/types/theme';

// Default themes - these will be seeded on first run
const DEFAULT_THEMES: CreateThemeInput[] = [
  {
    name: 'Default Sky',
    primaryColor: '#00c2e5',
    slateColor: '#64748b',
    borderRadius: 'md',
    shadowIntensity: 3,
  },
  {
    name: 'Ocean Deep',
    primaryColor: '#0077be',
    slateColor: '#475569',
    borderRadius: 'lg',
    shadowIntensity: 4,
  },
  {
    name: 'Forest Green',
    primaryColor: '#10b981',
    slateColor: '#6b7280',
    borderRadius: 'md',
    shadowIntensity: 2,
  },
  {
    name: 'Sunset Orange',
    primaryColor: '#f97316',
    slateColor: '#78716c',
    borderRadius: 'xl',
    shadowIntensity: 3,
  },
  {
    name: 'Purple Haze',
    primaryColor: '#a855f7',
    slateColor: '#71717a',
    borderRadius: 'lg',
    shadowIntensity: 4,
  },
  {
    name: 'Rose Pink',
    primaryColor: '#f43f5e',
    slateColor: '#737373',
    borderRadius: 'md',
    shadowIntensity: 3,
  },
  {
    name: 'Monochrome',
    primaryColor: '#525252',
    slateColor: '#737373',
    borderRadius: 'sm',
    shadowIntensity: 1,
  },
  {
    name: 'High Contrast',
    primaryColor: '#000000',
    slateColor: '#525252',
    borderRadius: 'none',
    shadowIntensity: 6,
  },
  {
    name: 'Nord Aurora',
    primaryColor: '#88c0d0',
    slateColor: '#4c566a',
    borderRadius: 'md',
    shadowIntensity: 2,
  },
  {
    name: 'Dracula Purple',
    primaryColor: '#bd93f9',
    slateColor: '#6272a4',
    borderRadius: 'lg',
    shadowIntensity: 3,
  },
  {
    name: 'Solarized',
    primaryColor: '#268bd2',
    slateColor: '#657b83',
    borderRadius: 'md',
    shadowIntensity: 2,
  },
  {
    name: 'Tokyo Night',
    primaryColor: '#7aa2f7',
    slateColor: '#565f89',
    borderRadius: 'lg',
    shadowIntensity: 3,
  },
];

class ThemeService {
  /**
   * Initialize default themes if they don't exist
   */
  async initializeDefaultThemes(): Promise<void> {
    const existingThemes = await this.getAllThemes();

    // If no themes exist, create all default themes
    if (existingThemes.length === 0) {
      for (const defaultTheme of DEFAULT_THEMES) {
        await this.createTheme(defaultTheme, true);
      }

      // Set the first theme (Default Sky) as active
      const firstTheme = await this.getAllThemes();
      if (firstTheme.length > 0) {
        await this.activateTheme(firstTheme[0].id);
      }
    }
  }

  /**
   * Get all themes
   */
  async getAllThemes(): Promise<Theme[]> {
    const result = await db
      .select()
      .from(themes)
      .orderBy(desc(themes.isDefault), desc(themes.createdAt));

    return result as Theme[];
  }

  /**
   * Get a theme by ID
   */
  async getTheme(id: string): Promise<Theme | null> {
    const result = await db.select().from(themes).where(eq(themes.id, id)).limit(1);

    if (result.length === 0) {
      return null;
    }

    return result[0] as Theme;
  }

  /**
   * Get the active theme
   */
  async getActiveTheme(): Promise<Theme | null> {
    const result = await db.select().from(themes).where(eq(themes.isActive, true)).limit(1);

    if (result.length === 0) {
      // If no active theme, activate the first default theme
      await this.initializeDefaultThemes();
      return this.getActiveTheme();
    }

    return result[0] as Theme;
  }

  /**
   * Create a new theme
   */
  async createTheme(input: CreateThemeInput, isDefault = false): Promise<Theme> {
    const now = new Date();
    const id = createId();

    const newTheme = {
      id,
      name: input.name,
      isDefault,
      isActive: false,
      primaryColor: input.primaryColor ?? '#00c2e5',
      slateColor: input.slateColor ?? '#64748b',
      borderRadius: input.borderRadius ?? 'md',
      shadowIntensity: input.shadowIntensity ?? 3,
      customCssVars: input.customCssVars ? JSON.stringify(input.customCssVars) : null,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(themes).values(newTheme);

    return newTheme as Theme;
  }

  /**
   * Update a theme
   */
  async updateTheme(id: string, input: UpdateThemeInput): Promise<Theme | null> {
    const existingTheme = await this.getTheme(id);

    if (!existingTheme) {
      return null;
    }

    // Prevent updating default themes' core properties (only allow customCssVars)
    if (existingTheme.isDefault && (input.name || input.primaryColor || input.slateColor)) {
      throw new Error('Cannot modify core properties of default themes');
    }

    const now = new Date();

    const updateData: Record<string, unknown> = {
      updatedAt: now,
    };

    if (input.name !== undefined) updateData.name = input.name;
    if (input.primaryColor !== undefined) updateData.primaryColor = input.primaryColor;
    if (input.slateColor !== undefined) updateData.slateColor = input.slateColor;
    if (input.borderRadius !== undefined) updateData.borderRadius = input.borderRadius;
    if (input.shadowIntensity !== undefined) updateData.shadowIntensity = input.shadowIntensity;
    if (input.customCssVars !== undefined) {
      updateData.customCssVars = input.customCssVars ? JSON.stringify(input.customCssVars) : null;
    }

    await db.update(themes).set(updateData).where(eq(themes.id, id));

    return this.getTheme(id);
  }

  /**
   * Delete a theme
   */
  async deleteTheme(id: string): Promise<boolean> {
    const theme = await this.getTheme(id);

    if (!theme) {
      return false;
    }

    // Prevent deleting default themes
    if (theme.isDefault) {
      throw new Error('Cannot delete default themes');
    }

    // If deleting the active theme, activate another theme first
    if (theme.isActive) {
      const otherThemes = await this.getAllThemes();
      const nextTheme = otherThemes.find(t => t.id !== id);
      if (nextTheme) {
        await this.activateTheme(nextTheme.id);
      }
    }

    await db.delete(themes).where(eq(themes.id, id));
    return true;
  }

  /**
   * Activate a theme (and deactivate others)
   */
  async activateTheme(id: string): Promise<Theme | null> {
    const theme = await this.getTheme(id);

    if (!theme) {
      return null;
    }

    // Deactivate all themes
    await db.update(themes).set({ isActive: false });

    // Activate the selected theme
    await db.update(themes).set({ isActive: true }).where(eq(themes.id, id));

    return this.getTheme(id);
  }

  /**
   * Duplicate a theme (useful for creating custom versions of default themes)
   */
  async duplicateTheme(id: string, newName?: string): Promise<Theme | null> {
    const theme = await this.getTheme(id);

    if (!theme) {
      return null;
    }

    const customCssVars = theme.customCssVars ? JSON.parse(theme.customCssVars) : null;

    return this.createTheme({
      name: newName ?? `${theme.name} (Copy)`,
      primaryColor: theme.primaryColor,
      slateColor: theme.slateColor,
      borderRadius: theme.borderRadius,
      shadowIntensity: theme.shadowIntensity,
      customCssVars,
    });
  }

  /**
   * Reset a theme to its default values (only for default themes)
   */
  async resetTheme(id: string): Promise<Theme | null> {
    const theme = await this.getTheme(id);

    if (!theme || !theme.isDefault) {
      return null;
    }

    // Find the original default theme configuration
    const defaultTheme = DEFAULT_THEMES.find(t => t.name === theme.name);

    if (!defaultTheme) {
      return null;
    }

    return this.updateTheme(id, {
      primaryColor: defaultTheme.primaryColor,
      slateColor: defaultTheme.slateColor,
      borderRadius: defaultTheme.borderRadius,
      shadowIntensity: defaultTheme.shadowIntensity,
      customCssVars: null,
    });
  }
}

export const themeService = new ThemeService();
