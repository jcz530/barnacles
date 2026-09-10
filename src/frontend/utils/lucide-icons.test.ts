import { describe, expect, it } from 'vitest';
import { Palette, Wrench } from 'lucide-vue-next';
import { resolveLucideIcon } from './lucide-icons';

describe('resolveLucideIcon', () => {
  it('resolves a name recorded in utility metadata', () => {
    expect(resolveLucideIcon('Palette')).toBe(Palette);
  });

  it('falls back to a generic glyph for a name lucide does not export', () => {
    // Icons are renamed upstream from time to time, and metadata is hand-written.
    // Rendering nothing at all would be a worse outcome than a wrench.
    expect(resolveLucideIcon('NotAnIconName')).toBe(Wrench);
  });

  it('falls back when no icon is recorded', () => {
    expect(resolveLucideIcon(undefined)).toBe(Wrench);
    expect(resolveLucideIcon(null)).toBe(Wrench);
    expect(resolveLucideIcon('')).toBe(Wrench);
  });

  it('never returns one of lucide’s non-component exports', () => {
    // `createLucideIcon` is a factory, not a component. An earlier version
    // indexed the whole lucide namespace and would have handed it straight to
    // <component :is>.
    expect(resolveLucideIcon('createLucideIcon')).toBe(Wrench);
  });

  it('resolves every icon the shipped utilities name', () => {
    // The map is explicit, so a utility naming an icon nobody added would
    // silently render a wrench. Catch that here rather than in the UI.
    for (const name of ['Palette', 'Network', 'Image']) {
      expect(resolveLucideIcon(name)).not.toBe(Wrench);
    }
  });
});
