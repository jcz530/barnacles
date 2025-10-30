/**
 * CLI-side utility registry
 * This mirrors the frontend utilities but is separate to avoid importing Vue components in the CLI
 */

interface UtilityCliHandler {
  execute: (args: string[], flags: Record<string, string | boolean>) => Promise<void>;
  helpText?: string;
  examples?: string[];
}

interface UtilityCliRegistration {
  id: string;
  name: string;
  description: string;
  handler: UtilityCliHandler;
}

class UtilityCliRegistry {
  private utilities: Map<string, UtilityCliRegistration> = new Map();

  register(registration: UtilityCliRegistration): void {
    this.utilities.set(registration.id, registration);
  }

  get(id: string): UtilityCliRegistration | undefined {
    return this.utilities.get(id);
  }

  getAll(): UtilityCliRegistration[] {
    return Array.from(this.utilities.values());
  }
}

export const cliUtilityRegistry = new UtilityCliRegistry();

// Register utilities with CLI handlers
export function registerCliUtilities(): void {
  // Import and register color-converter
  import('./color-converter.js').then(module => {
    cliUtilityRegistry.register(module.colorConverterCli);
  });

  // Import and register shade-generator
  import('./shade-generator.js').then(module => {
    cliUtilityRegistry.register(module.shadeGeneratorCli);
  });

  // Future utilities can be registered here
}
