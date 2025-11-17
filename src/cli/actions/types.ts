import type { ProjectWithDetails } from '../../shared/types/api.js';

/**
 * Base interface for project actions
 */
export interface ProjectAction {
  /**
   * Unique identifier for the action
   */
  id: string;

  /**
   * Display label for the action
   */
  label: string;

  /**
   * Optional hint/description text
   */
  hint?: string;

  /**
   * Execute the action with the given project
   */
  execute(project: ProjectWithDetails): Promise<void>;
}

/**
 * Configuration for autocomplete options
 */
export interface ActionOption {
  value: string;
  label: string;
  hint: string;
}
