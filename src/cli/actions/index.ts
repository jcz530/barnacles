import type { ActionOption, ProjectAction } from './types.js';
import { CopyPathAction } from './copy-path.js';
import { OpenInFinderAction } from './open-in-finder.js';
import { OpenInTerminalAction } from './open-in-terminal.js';
import { StartAction } from './start.js';
import { StopAction } from './stop.js';

/**
 * Registry of all available project actions
 */
export const PROJECT_ACTIONS: ProjectAction[] = [
  new StartAction(),
  new StopAction(),
  new OpenInTerminalAction(),
  new CopyPathAction(),
  new OpenInFinderAction(),
  // TODO: Add more actions here as they're implemented
  // new ScriptsAction(),
  // new OpenInIDEAction(),
  // new GitRemoteAction(),
];

/**
 * Get an action by its ID
 */
export function getAction(id: string): ProjectAction | undefined {
  return PROJECT_ACTIONS.find(action => action.id === id);
}

/**
 * Convert actions to autocomplete options
 */
export function getActionOptions(): ActionOption[] {
  return PROJECT_ACTIONS.map(action => ({
    value: action.id,
    label: action.label,
    hint: action.hint || '',
  }));
}

// Re-export types for convenience
export type { ProjectAction, ActionOption } from './types.js';
