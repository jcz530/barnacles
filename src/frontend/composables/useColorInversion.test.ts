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
const root = resolve(__dirname, '..', '..', '..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');

/**
 * Palettes useTheme generates and writes. Read from the `palettes` map it
 * builds, which is the declaration site — regexing the --color-${name}
 * template literal would just match the loop variable.
 */
function themedPalettes(): Set<string> {
  const src = read('src/frontend/composables/useTheme.ts');
  const block = src.slice(
    src.indexOf('const palettes = {'),
    src.indexOf('for (const [name, palette]')
  );
  const names = new Set<string>();
  for (const m of block.matchAll(/^\s{6}([a-z]+):\s*\w+Palette,/gm)) names.add(m[1]);
  return names;
}

function colorScalesBlock(): string {
  const src = read('src/frontend/composables/useColorInversion.ts');
  return src.slice(src.indexOf('const colorScales'), src.indexOf('function getInvertedShade'));
}

function invertedPalettes(): Set<string> {
  const names = new Set<string>();
  for (const m of colorScalesBlock().matchAll(/^\s{2}([a-z]+):\s*\[/gm)) names.add(m[1]);
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

  it('actually parses a colorScales block', () => {
    // These checks slice the source between markers. When the markers drift the
    // slice comes back empty and every coverage assertion below passes
    // vacuously, so assert the parse found something first.
    expect(invertedPalettes().size).toBeGreaterThan(20);
  });

  it('inverts every palette useTheme writes', () => {
    const inverted = invertedPalettes();
    const missing = [...themedPalettes()].filter(p => !inverted.has(p)).sort();
    expect(missing, `written by useTheme but never inverted: ${missing.join(', ')}`).toEqual([]);
  });

  it('gives every shade a 1000-complement within the same scale', () => {
    for (const m of colorScalesBlock().matchAll(/^\s{2}([a-z]+):\s*\[([^\]]+)\]/gm)) {
      const shades = m[2].split(',').map(s => Number(s.trim()));
      for (const shade of shades) {
        expect(shades, `${m[1]}-${shade} has no ${1000 - shade} counterpart`).toContain(
          1000 - shade
        );
      }
    }
  });
});

/**
 * useDark and useColorMode both default to the storage key
 * 'vueuse-color-scheme', and useDark IS useColorMode with the auto state
 * collapsed away. Pairing a useDark with a useLocalStorage on that same key
 * gives two refs writing one slot: ThemeToggle raced itself, and the command
 * palette's toggleTheme wrote the stored value without ever applying the class
 * to <html>. One ref per surface, and never a raw useLocalStorage on that key.
 */
describe('color mode is owned by one ref per surface', () => {
  const surfaces = [
    'src/frontend/components/nav/molecules/ThemeToggle.vue',
    'src/frontend/commands/useCommandRegistry.ts',
  ];

  it('never pairs a color-mode ref with a raw useLocalStorage on its key', () => {
    for (const file of surfaces) {
      const src = read(file);
      expect(src, `${file} writes the color-mode key through raw storage`).not.toMatch(
        /useLocalStorage<[^>]*>\('vueuse-color-scheme'/
      );
    }
  });

  it('keeps the light class name that main.css and the inversion key off', () => {
    // main.css pairs a `.dark` block with `:root`, and useColorInversion reads
    // the same class, so a bare '' light value would desync the inversion.
    for (const file of surfaces) {
      expect(read(file), `${file} must map light -> 'light'`).toMatch(/light:\s*'light'/);
    }
  });
});

/**
 * The half-light bug: useTheme has six callers, and every instance used to
 * register watch(activeTheme, ..., { immediate: true }). TanStack serves the
 * cached theme synchronously, so mounting any component that merely reads the
 * theme re-ran applyThemeVariables and repainted the LIGHT palette. Nothing
 * re-inverted it -- App's reinit watcher was immediate:false and only fired on
 * an actual change -- so visiting /themes in dark mode left the app half
 * inverted, with .dark's --background: var(--color-slate-300) resolving against
 * an un-inverted slate.
 */
describe('theme application has a single owner', () => {
  const useTheme = () => read('src/frontend/composables/useTheme.ts');

  it('gates the apply watcher behind an explicit opt-in', () => {
    expect(useTheme()).toMatch(/if \(options\.applyToDocument && !hasApplyOwner\)/);
  });

  it('re-inverts synchronously at the end of applyThemeVariables', () => {
    const src = useTheme();
    const body = src.slice(src.indexOf('function applyThemeVariables'));
    const end = body.indexOf('\n  }');
    expect(body.slice(0, end), 'applyThemeVariables must re-invert after writing').toMatch(
      /reinitializeColors\(\);/
    );
  });

  it('is opted into by App and by nobody else', () => {
    const optedIn = [
      'src/frontend/App.vue',
      'src/frontend/views/Themes.vue',
      'src/frontend/views/ThemeEditor.vue',
      'src/frontend/components/settings/molecules/ThemeCard.vue',
      'src/frontend/components/settings/organisms/ThemesSetting.vue',
      'src/frontend/components/nav/atoms/LogoMark.vue',
    ].filter(f => /applyToDocument:\s*true/.test(read(f)));

    expect(optedIn).toEqual(['src/frontend/App.vue']);
  });

  it('does not re-invert on a timer', () => {
    // The old App watcher guessed at 50ms for the CSS writes to land. The
    // apply path is synchronous, so a timer here means the race is back.
    expect(read('src/frontend/App.vue')).not.toMatch(/setTimeout[\s\S]{0,80}reinitializeColors/);
  });
});
