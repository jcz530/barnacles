import { vi } from 'vitest';
import { db } from '@shared/database/connection';
import { clearAllTables } from '@test/setup/test-db-helpers';
import type { DB } from '@shared/database';
import type { Command } from '@cli/core/Command';

export interface CLITestContext<T extends Command = Command> {
  db: DB;
  command: T;
}

export interface CLIMockOptions {
  /** Mock @clack/prompts */
  mockPrompts?: boolean;
  /** Mock branding utilities */
  mockBranding?: boolean;
  /** Mock picocolors */
  mockColors?: boolean;
  /** Mock app-manager (backend URL detection) */
  mockAppManager?: boolean | { backendUrl: string | null };
}

/**
 * Creates a reusable context for CLI command tests
 *
 * @example
 * ```typescript
 * const context = createCLITestContext<StatusCommand>();
 *
 * beforeEach(async () => {
 *   await context.setup(
 *     () => new StatusCommand(),
 *     {
 *       mockPrompts: true,
 *       mockAppManager: { backendUrl: null }
 *     }
 *   );
 * });
 *
 * afterEach(async () => {
 *   await context.teardown();
 * });
 *
 * it('should work', async () => {
 *   const { command, db } = context.get();
 *   await command.execute({}, []);
 * });
 * ```
 */
export function createCLITestContext<T extends Command = Command>() {
  let command: T | null = null;

  /**
   * Setup the test context with database and command
   * @param commandFactory - Function that creates and returns the command instance
   * @param mockOptions - Options for mocking CLI dependencies
   */
  async function setup(
    commandFactory: () => T,
    mockOptions: CLIMockOptions = {}
  ): Promise<CLITestContext<T>> {
    const {
      mockPrompts = true,
      mockBranding = true,
      mockColors = true,
      mockAppManager = true,
    } = mockOptions;

    // Setup common mocks
    if (mockPrompts) {
      setupPromptMocks();
    }

    if (mockBranding) {
      setupBrandingMocks();
    }

    if (mockColors) {
      setupColorMocks();
    }

    if (mockAppManager) {
      const backendUrl =
        typeof mockAppManager === 'object' && 'backendUrl' in mockAppManager
          ? mockAppManager.backendUrl
          : null;
      setupAppManagerMocks(backendUrl);
    }

    // Clear all data from the shared in-memory database to ensure test isolation
    await clearAllTables(db);

    // Create the command instance
    command = commandFactory();

    return { db, command };
  }

  /**
   * Teardown the test context
   */
  async function teardown(): Promise<void> {
    // Clear all data to ensure test isolation
    await clearAllTables(db);
    vi.clearAllMocks();

    // Reset state
    command = null;
  }

  /**
   * Get the current context (throws if not setup)
   */
  function get(): CLITestContext<T> {
    if (!command) {
      throw new Error('Test context not initialized. Did you call setup() in beforeEach?');
    }
    return { db, command };
  }

  return { setup, teardown, get };
}

/**
 * Setup mocks for @clack/prompts
 */
function setupPromptMocks() {
  vi.mock('@clack/prompts', () => ({
    intro: vi.fn(),
    outro: vi.fn(),
    box: vi.fn(),
    spinner: vi.fn(() => ({
      start: vi.fn(),
      stop: vi.fn(),
      message: vi.fn(),
    })),
    text: vi.fn(),
    select: vi.fn(),
    multiselect: vi.fn(),
    confirm: vi.fn(),
    isCancel: vi.fn(() => false),
    cancel: vi.fn(),
    note: vi.fn(),
    log: {
      success: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      message: vi.fn(),
      step: vi.fn(),
    },
  }));
}

/**
 * Setup mocks for branding utilities
 */
function setupBrandingMocks() {
  vi.mock('@cli/utils/branding.js', () => ({
    compactLogo: '🦀',
    fullLogo: '🦀 Barnacles',
  }));
}

/**
 * Setup mocks for picocolors
 */
function setupColorMocks() {
  vi.mock('picocolors', () => ({
    default: {
      dim: (text: string) => text,
      bold: (text: string) => text,
      cyan: (text: string) => text,
      green: (text: string) => text,
      red: (text: string) => text,
      yellow: (text: string) => text,
      blue: (text: string) => text,
      magenta: (text: string) => text,
      gray: (text: string) => text,
    },
  }));
}

/**
 * Setup mocks for app-manager utilities
 */
function setupAppManagerMocks(backendUrl: string | null = null) {
  vi.mock('@cli/utils/app-manager.js', () => ({
    getBackendUrl: vi.fn(() => Promise.resolve(backendUrl)),
    isAppRunning: vi.fn(() => Promise.resolve(backendUrl !== null)),
    openApp: vi.fn(() => Promise.resolve()),
  }));
}

/**
 * Mock the database connection for use in tests
 * This is now a no-op since the database is mocked globally in vitest-setup.ts
 * Kept for backward compatibility with existing test files
 * @deprecated No longer needed - database is mocked globally
 */
export function mockDatabaseConnection() {
  // No-op: The database is now mocked globally in vitest-setup.ts
  // This function is kept for backward compatibility
}
