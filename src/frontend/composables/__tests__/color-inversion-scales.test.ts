import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Dark mode is palette inversion, so a themeable palette missing from
 * useColorInversion's colorScales resolves in light mode and silently stays
 * light in dark mode — how secondary/tertiary/success/danger were all left
 * un-inverted while the chrome around them flipped.
 *
 * The set of palettes that must invert is the set useTheme writes at runtime,
 * not the set main.css declares: slate is never declared in main.css (it comes
 * from Tailwind's built-in palette) but useTheme overrides it per theme, so it
 * has to invert too.
 */
const root = resolve(__dirname, '../../..', '..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

/** Palettes useTheme generates and writes as --color-<name>-<shade>. */
function themedPalettes(): Set<string> {
  const src = read('src/frontend/composables/useTheme.ts');
  const names = new Set<string>();
  for (const m of src.matchAll(/--color-\$\{?([a-z]+)/g)) names.add(m[1]);
  for (const m of src.matchAll(/`--color-([a-z]+)-\$\{/g)) names.add(m[1]);
  return names;
}

function colorScalesBlock(): string {
  const src = read('src/frontend/composables/useColorInversion.ts');
  return src.slice(src.indexOf('const colorScales'), src.indexOf('// Store original values'));
}

function invertedPalettes(): Set<string> {
  const names = new Set<string>();
  for (const m of colorScalesBlock().matchAll(/^\s{4}([a-z]+):\s*\[/gm)) names.add(m[1]);
  return names;
}

describe('color inversion covers every themeable palette', () => {
  it('finds the palettes useTheme writes', () => {
    // Guards the check below: if this regex stops matching, the coverage
    // assertion would pass vacuously against an empty set.
    expect([...themedPalettes()].sort()).toEqual([
      'danger',
      'primary',
      'secondary',
      'slate',
      'success',
      'tertiary',
    ]);
  });

  it('inverts every palette useTheme writes', () => {
    const inverted = invertedPalettes();
    const missing = [...themedPalettes()].filter(p => !inverted.has(p)).sort();
    expect(missing, `written by useTheme but never inverted: ${missing.join(', ')}`).toEqual([]);
  });

  it('gives every shade a 1000-complement within the same scale', () => {
    for (const m of colorScalesBlock().matchAll(/^\s{4}([a-z]+):\s*\[([^\]]+)\]/gm)) {
      const shades = m[2].split(',').map(s => Number(s.trim()));
      for (const shade of shades) {
        expect(shades, `${m[1]}-${shade} has no ${1000 - shade} counterpart`).toContain(
          1000 - shade
        );
      }
    }
  });
});
