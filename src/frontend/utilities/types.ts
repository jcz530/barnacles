import type { Component } from 'vue';

/**
 * Metadata for a utility that can be registered in the system
 */
export interface UtilityMetadata {
  /** Unique identifier for the utility (e.g., 'color-converter') */
  id: string;

  /** Display name shown in UI (e.g., 'CSS Color Converter') */
  name: string;

  /** Brief description of what the utility does */
  description: string;

  /** Lucide icon name (e.g., 'Palette', 'Calculator') */
  icon: string;

  /** Route path for the utility page (e.g., '/utilities/color-converter') */
  route: string;

  /** Vue component for the utility page */
  component: () => Promise<Component>;

  /** Whether this utility has CLI support */
  cli: boolean;

  /** Whether this utility requires backend API support */
  api: boolean;

  /** Optional category for grouping utilities */
  category?: string;

  /** Optional tags for searching/filtering */
  tags?: string[];
}

/**
 * CLI handler for a utility command
 */
export interface UtilityCliHandler {
  /** Execute the CLI command with provided arguments */
  execute: (args: string[], flags: Record<string, string | boolean>) => Promise<void>;

  /** Optional help text for the CLI command */
  helpText?: string;

  /** Optional usage examples */
  examples?: string[];
}

/**
 * Complete utility registration including metadata and optional CLI handler
 */
export interface UtilityRegistration {
  metadata: UtilityMetadata;
  cliHandler?: UtilityCliHandler;
}
