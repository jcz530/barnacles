import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Dark mode is runtime palette inversion, so `bg-slate-50` is already
 * theme-aware and a `dark:` variant on a themed palette applies a SECOND
 * transformation on top of the inversion. The semantic tokens are covered too:
 * main.css defines --input, --accent, --foreground and --destructive in terms
 * of the themed scales, so they invert with them.
 *
 * The one thing inversion cannot express is opacity, so `dark:` is still
 * allowed when it only changes an alpha (`ring-destructive/20` ->
 * `/40`, `dark:bg-input/30` on an otherwise transparent field).
 */
const root = resolve(__dirname, '..', '..', '..');

/** Every dark: utility written anywhere in the renderer source. */
function darkVariants(): string[] {
  const out: string[] = [];
  const pattern = /dark:[a-z0-9:/[\]().&_=-]+/g;

  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const full = resolve(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (/\.(vue|ts)$/.test(e.name) && !e.name.endsWith('.test.ts')) {
        out.push(...(readFileSync(full, 'utf8').match(pattern) ?? []));
      }
    }
  };
  walk(resolve(root, 'src/frontend'));

  // `modes: { light: 'light', dark: 'dark' }` in the useColorMode config is not
  // a utility class.
  return out.filter(v => v !== 'dark:' && !v.startsWith('dark:dark'));
}

describe('dark: variants', () => {
  it('never applies a colour swap on a themed palette', () => {
    const offenders = darkVariants().filter(v =>
      /-(slate|success|danger|primary|secondary|tertiary)-\d+$/.test(v)
    );
    expect(offenders, `these fight the inversion: ${offenders.join(', ')}`).toEqual([]);
  });

  it('only survives where it changes opacity', () => {
    // Every remaining dark: must carry an alpha suffix. A bare token swap has
    // no opacity component, so inversion already covers it.
    const offenders = darkVariants().filter(v => !/\/\d+$/.test(v));
    expect(
      offenders,
      `no opacity component, so inversion covers it: ${offenders.join(', ')}`
    ).toEqual([]);
  });

  it('finds the variants it is checking', () => {
    // Guards the two checks above: if the grep stops matching they pass
    // vacuously against an empty list.
    expect(darkVariants().length).toBeGreaterThan(5);
  });
});
