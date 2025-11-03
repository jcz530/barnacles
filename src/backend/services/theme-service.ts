import { db } from '../../shared/database/connection';
import { themes } from '../../shared/database/schema';
import { desc, eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import type { CreateThemeInput, Theme, UpdateThemeInput } from '../../shared/types/theme';

// Default themes - these will be seeded on first run
const DEFAULT_THEMES: CreateThemeInput[] = [
  {
    name: 'Default Sky',
    primaryColor: '#00c2e5',
    secondaryColor: '#ec4899',
    tertiaryColor: '#8b5cf6',
    slateColor: '#64748b',
    successColor: '#10b981',
    dangerColor: '#ef4444',
    borderRadius: 'md',
  },
  {
    name: 'Ocean Deep',
    primaryColor: '#0077be',
    secondaryColor: '#06b6d4',
    tertiaryColor: '#3b82f6',
    slateColor: '#475569',
    successColor: '#059669',
    dangerColor: '#dc2626',
    borderRadius: 'lg',
  },
  {
    name: 'Forest Green',
    primaryColor: '#10b981',
    secondaryColor: '#22c55e',
    tertiaryColor: '#84cc16',
    slateColor: '#6b7280',
    successColor: '#059669',
    dangerColor: '#f97316',
    borderRadius: 'md',
  },
  {
    name: 'Sunset Orange',
    primaryColor: '#f97316',
    secondaryColor: '#fb923c',
    tertiaryColor: '#fbbf24',
    slateColor: '#78716c',
    successColor: '#84cc16',
    dangerColor: '#dc2626',
    borderRadius: 'xl',
  },
  {
    name: 'Purple Haze',
    primaryColor: '#a855f7',
    secondaryColor: '#c026d3',
    tertiaryColor: '#d946ef',
    slateColor: '#71717a',
    successColor: '#22c55e',
    dangerColor: '#f43f5e',
    borderRadius: 'lg',
  },
  {
    name: 'Rose Pink',
    primaryColor: '#f43f5e',
    secondaryColor: '#ec4899',
    tertiaryColor: '#fb7185',
    slateColor: '#737373',
    successColor: '#10b981',
    dangerColor: '#dc2626',
    borderRadius: 'md',
  },
  {
    name: 'Monochrome',
    primaryColor: '#525252',
    secondaryColor: '#737373',
    tertiaryColor: '#a3a3a3',
    slateColor: '#737373',
    successColor: '#404040',
    dangerColor: '#171717',
    borderRadius: 'sm',
  },
  {
    name: 'High Contrast',
    primaryColor: '#000000',
    secondaryColor: '#ffffff',
    tertiaryColor: '#525252',
    slateColor: '#525252',
    successColor: '#22c55e',
    dangerColor: '#dc2626',
    borderRadius: 'none',
  },
  {
    name: 'Nord Aurora',
    primaryColor: '#88c0d0',
    secondaryColor: '#81a1c1',
    tertiaryColor: '#5e81ac',
    slateColor: '#4c566a',
    successColor: '#a3be8c',
    dangerColor: '#bf616a',
    borderRadius: 'md',
  },
  {
    name: 'Dracula Purple',
    primaryColor: '#bd93f9',
    secondaryColor: '#ff79c6',
    tertiaryColor: '#8be9fd',
    slateColor: '#6272a4',
    successColor: '#50fa7b',
    dangerColor: '#ff5555',
    borderRadius: 'lg',
  },
  {
    name: 'Solarized',
    primaryColor: '#268bd2',
    secondaryColor: '#2aa198',
    tertiaryColor: '#859900',
    slateColor: '#657b83',
    successColor: '#859900',
    dangerColor: '#dc322f',
    borderRadius: 'md',
  },
  {
    name: 'Tokyo Night',
    primaryColor: '#7aa2f7',
    secondaryColor: '#bb9af7',
    tertiaryColor: '#7dcfff',
    slateColor: '#565f89',
    successColor: '#9ece6a',
    dangerColor: '#f7768e',
    borderRadius: 'lg',
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
      secondaryColor: input.secondaryColor ?? '#ec4899',
      tertiaryColor: input.tertiaryColor ?? '#8b5cf6',
      slateColor: input.slateColor ?? '#64748b',
      successColor: input.successColor ?? '#10b981',
      dangerColor: input.dangerColor ?? '#ef4444',
      fontUi: input.fontUi ?? null,
      fontHeading: input.fontHeading ?? null,
      fontCode: input.fontCode ?? null,
      borderRadius: input.borderRadius ?? 'md',
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

    const now = new Date();

    const updateData: Record<string, unknown> = {
      updatedAt: now,
    };

    // Prevent updating default themes' core properties (only allow customCssVars)
    if (!existingTheme.isDefault) {
      if (input.name !== undefined) updateData.name = input.name;
      if (input.primaryColor !== undefined) updateData.primaryColor = input.primaryColor;
      if (input.secondaryColor !== undefined) updateData.secondaryColor = input.secondaryColor;
      if (input.tertiaryColor !== undefined) updateData.tertiaryColor = input.tertiaryColor;
      if (input.slateColor !== undefined) updateData.slateColor = input.slateColor;
      if (input.successColor !== undefined) updateData.successColor = input.successColor;
      if (input.dangerColor !== undefined) updateData.dangerColor = input.dangerColor;
    }

    if (input.fontUi !== undefined) updateData.fontUi = input.fontUi;
    if (input.fontHeading !== undefined) updateData.fontHeading = input.fontHeading;
    if (input.fontCode !== undefined) updateData.fontCode = input.fontCode;
    if (input.borderRadius !== undefined) updateData.borderRadius = input.borderRadius;
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
      secondaryColor: theme.secondaryColor,
      tertiaryColor: theme.tertiaryColor,
      slateColor: theme.slateColor,
      successColor: theme.successColor,
      dangerColor: theme.dangerColor,
      fontUi: theme.fontUi,
      fontHeading: theme.fontHeading,
      fontCode: theme.fontCode,
      borderRadius: theme.borderRadius,
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
      secondaryColor: defaultTheme.secondaryColor,
      tertiaryColor: defaultTheme.tertiaryColor,
      slateColor: defaultTheme.slateColor,
      successColor: defaultTheme.successColor,
      dangerColor: defaultTheme.dangerColor,
      fontUi: defaultTheme.fontUi ?? null,
      fontHeading: defaultTheme.fontHeading ?? null,
      fontCode: defaultTheme.fontCode ?? null,
      borderRadius: defaultTheme.borderRadius,
      customCssVars: null,
    });
  }
}

export const themeService = new ThemeService();
