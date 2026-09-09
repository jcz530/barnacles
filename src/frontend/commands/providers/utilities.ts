import type { UtilityMetadata } from '@/utilities/types';
import { resolveLucideIcon } from '@/utils/lucide-icons';
import type { Command } from '../types';

/**
 * One command per registered utility.
 *
 * The list is passed in rather than read from the registry here so this stays a
 * pure function of its input, testable without standing up the registry (and
 * without the Vite-only `import.meta.glob` that populates it).
 */
export const utilityCommands = (utilities: UtilityMetadata[]): Command[] =>
  utilities.map(utility => ({
    id: `utility.${utility.id}`,
    title: utility.name,
    subtitle: utility.description,
    group: 'utilities' as const,
    // Each utility records its own icon by name; a shared glyph for all of them
    // would make the group unscannable.
    icon: resolveLucideIcon(utility.icon),
    keywords: [...(utility.tags ?? []), utility.category ?? '', 'utility', 'tool'].filter(Boolean),
    run: ctx => ctx.navigate(utility.route),
  }));
