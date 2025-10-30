import type { UtilityMetadata, UtilityRegistration } from './types';

/**
 * Registry for all utilities in the application
 */
class UtilityRegistry {
  private utilities: Map<string, UtilityRegistration> = new Map();

  /**
   * Register a utility
   */
  register(registration: UtilityRegistration): void {
    this.utilities.set(registration.metadata.id, registration);
  }

  /**
   * Get a utility by ID
   */
  get(id: string): UtilityRegistration | undefined {
    return this.utilities.get(id);
  }

  /**
   * Get all registered utilities
   */
  getAll(): UtilityRegistration[] {
    return Array.from(this.utilities.values());
  }

  /**
   * Get all utility metadata (for UI display)
   */
  getAllMetadata(): UtilityMetadata[] {
    return this.getAll().map(reg => reg.metadata);
  }

  /**
   * Get utilities by category
   */
  getByCategory(category: string): UtilityRegistration[] {
    return this.getAll().filter(reg => reg.metadata.category === category);
  }

  /**
   * Search utilities by name, description, or tags
   */
  search(query: string): UtilityMetadata[] {
    const lowerQuery = query.toLowerCase();
    return this.getAllMetadata().filter(
      meta =>
        meta.name.toLowerCase().includes(lowerQuery) ||
        meta.description.toLowerCase().includes(lowerQuery) ||
        meta.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }
}

// Create singleton registry
export const utilityRegistry = new UtilityRegistry();

/**
 * Auto-discover and register all utilities
 * Uses Vite's import.meta.glob to find all utility index files
 */
export async function discoverUtilities(): Promise<void> {
  // Import all utility registration files
  // Pattern matches: ./[utility-name]/index.ts
  const utilityModules = import.meta.glob<{ default: UtilityRegistration }>('./**/index.ts', {
    eager: false,
  });

  // Register each utility
  for (const [path, importFn] of Object.entries(utilityModules)) {
    // Skip the main index file (this file)
    if (path === './index.ts') continue;

    try {
      const module = await importFn();
      if (module.default) {
        utilityRegistry.register(module.default);
      }
    } catch (error) {
      console.error(`Failed to register utility from ${path}:`, error);
    }
  }
}

/**
 * Get utility metadata by ID
 */
export function getUtility(id: string): UtilityMetadata | undefined {
  return utilityRegistry.get(id)?.metadata;
}

/**
 * Get all utilities
 */
export function getAllUtilities(): UtilityMetadata[] {
  return utilityRegistry.getAllMetadata();
}

/**
 * Search utilities
 */
export function searchUtilities(query: string): UtilityMetadata[] {
  return utilityRegistry.search(query);
}
