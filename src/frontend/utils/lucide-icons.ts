import { Image, Network, Palette, Wrench } from 'lucide-vue-next';
import type { LucideIcon } from 'lucide-vue-next';

/**
 * Icons that utility metadata is allowed to name.
 *
 * Deliberately an explicit map rather than `import * as LucideIcons` and an
 * index. The namespace import defeats tree-shaking, and this module is reached
 * from the command palette, which the floating window loads eagerly -- measured
 * at ~800KB of extra renderer JS for the sake of three glyphs.
 *
 * Adding a utility that wants a new icon means adding a line here. That is the
 * intended trade: metadata stays plain data (a string the CLI can read too),
 * and the bundle only carries icons that are actually used.
 */
const UTILITY_ICONS: Record<string, LucideIcon> = {
  Image,
  Network,
  Palette,
  Wrench,
};

/**
 * Resolve a Lucide icon component from the name recorded in data.
 *
 * Utility metadata stores its icon as a string (`'Palette'`) rather than a
 * component so a registration file stays plain data. This is the one place that
 * turns such a name back into something renderable.
 *
 * Falls back to a generic glyph rather than rendering nothing when a name is
 * missing, typo'd, or not in the map above.
 */
export const resolveLucideIcon = (name: string | null | undefined): LucideIcon =>
  (name ? UTILITY_ICONS[name] : undefined) ?? Wrench;
