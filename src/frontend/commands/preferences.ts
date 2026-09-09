/** The shape both DetectedIDE and DetectedTerminal share. */
export interface PreferableTool {
  id: string;
  name: string;
  installed?: boolean;
}

/**
 * Which tool to open a project with, following the same cascade the project
 * page's split buttons use: the project's own preference first, then the global
 * default, then nothing.
 *
 * Both steps check the tool is actually installed. A project can hold a
 * preference for an editor that has since been uninstalled, and falling through
 * to the global default is far better than failing; the same goes for a global
 * default pointing at something no longer present.
 *
 * Returning null is meaningful rather than an error: it means there is nothing
 * sensible to default to, so the caller should ask instead of guessing.
 */
export const resolvePreferred = <T extends PreferableTool>(
  installed: T[],
  projectPreferenceId: string | null | undefined,
  globalDefaultId: string | null | undefined
): T | null => {
  const preferred = projectPreferenceId
    ? installed.find(tool => tool.id === projectPreferenceId)
    : undefined;
  if (preferred) return preferred;

  const fallback = globalDefaultId
    ? installed.find(tool => tool.id === globalDefaultId)
    : undefined;
  return fallback ?? null;
};
