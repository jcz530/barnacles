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
 * Every utility registration, loaded when this module is evaluated.
 *
 * Eager on purpose. Discovery used to be async and was only ever triggered by
 * the /utilities routes, so anything that read the registry without visiting
 * one of those pages first -- the command palette, most of all -- saw it empty.
 * The floating palette window has no router at all and so could never populate
 * it. Registering at module-eval time means every consumer sees a full registry
 * on first read, with no ordering to get wrong.
 *
 * The cost is small: this pattern matches only the per-utility `index.ts`
 * registration files, each of which is a plain metadata object whose page stays
 * behind its own `component: () => import(...)`. The views are still lazy.
 *
 * The corollary is that a registration file must stay side-effect-free and
 * import only types and pure helpers. A module that throws while loading now
 * takes the renderer down with it, where the old per-utility try/catch would
 * have logged and carried on.
 */
const utilityModules = import.meta.glob<{ default: UtilityRegistration }>('./*/index.ts', {
  eager: true,
});

for (const [path, module] of Object.entries(utilityModules)) {
  if (module.default) {
    utilityRegistry.register(module.default);
  } else {
    console.error(`Utility at ${path} has no default export; skipping.`);
  }
}

/**
 * Kept for callers that ran discovery before reading the registry.
 *
 * Registration now happens above, when this module is first evaluated, so this
 * is a no-op that resolves immediately.
 */
export async function discoverUtilities(): Promise<void> {
  // Intentionally empty -- see utilityModules above.
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
