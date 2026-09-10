import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findProjectIcon, findProjectIconCandidates } from '@backend/utils/icon-finder';

/**
 * Each suite rebuilds the shape of a real project that the previous detector
 * failed on, so a regression names the layout it broke.
 */
describe('findProjectIcon', () => {
  let root: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'icon-finder-'));
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  /** Writes a file, creating parents. Non-empty so it survives the size check. */
  const write = async (relPath: string, content = 'x') => {
    const full = path.join(root, relPath);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content);
  };

  describe('Electron app declaring icons in electron-builder.yml', () => {
    // The app's own layout: icons under assets/icons/, declared in a standalone
    // YAML, with a buildResources dir that holds no images at all.
    const buildYml = [
      'appId: com.example.app',
      'icon: assets/icons/app',
      'directories:',
      '  buildResources: build',
      'mac:',
      '  icon: assets/icons/app.icns',
      'win:',
      '  icon: assets/icons/app.ico',
      'linux:',
      '  icon: assets/icons/app.png',
    ].join('\n');

    beforeEach(async () => {
      await write('electron-builder.yml', buildYml);
      await write('package.json', JSON.stringify({ name: 'app' }));
      await write('assets/icons/app.png');
      await write('assets/icons/app.icns');
      await write('assets/icons/app.ico');
      await write('build/entitlements.mac.plist');
      await write('src/main/assets/tray-iconTemplate.png');
      await write('src/frontend/assets/logo-mark.svg');
    });

    it('resolves the declared icon to a renderable png', async () => {
      expect(await findProjectIcon(root)).toBe('assets/icons/app.png');
    });

    it('never returns an .icns, which no browser can render', async () => {
      const candidates = await findProjectIconCandidates(root);
      expect(candidates.every(c => !c.path.endsWith('.icns'))).toBe(true);
    });

    it('resolves the extension-less declaration on its own', async () => {
      // Only the top-level `icon: assets/icons/app` line, no platform blocks.
      await write('electron-builder.yml', 'icon: assets/icons/app\n');
      expect(await findProjectIcon(root)).toBe('assets/icons/app.png');
    });

    it('finds the sibling png when only an .icns is declared', async () => {
      await write('electron-builder.yml', 'mac:\n  icon: assets/icons/app.icns\n');
      expect(await findProjectIcon(root)).toBe('assets/icons/app.png');
    });

    it('rejects a macOS template image even as the only remaining png', async () => {
      await fs.rm(path.join(root, 'assets'), { recursive: true, force: true });
      await fs.rm(path.join(root, 'electron-builder.yml'), { force: true });
      expect(await findProjectIcon(root)).not.toContain('tray-iconTemplate');
    });

    it('reads the same declaration from package.json build', async () => {
      await fs.rm(path.join(root, 'electron-builder.yml'), { force: true });
      await write(
        'package.json',
        JSON.stringify({ name: 'app', build: { mac: { icon: 'assets/icons/app.icns' } } })
      );
      expect(await findProjectIcon(root)).toBe('assets/icons/app.png');
    });
  });

  describe('Laravel root with a nested Nuxt frontend', () => {
    beforeEach(async () => {
      // The Laravel public/ holds only index.php: the real icon is one level in.
      await write('artisan');
      await write('composer.json', '{}');
      await write('public/index.php', '<?php');
      await write('frontend/package.json', JSON.stringify({ name: 'frontend' }));
      await write('frontend/nuxt.config.ts', 'export default {}');
      await write('frontend/public/favicon.ico');
      await write('frontend/public/robots.txt');
      // Decoys inside directories that must never be traversed.
      await write('vendor/some/pkg/favicon.svg');
      await write('node_modules/pkg/favicon.svg');
    });

    it('descends into the nested app', async () => {
      expect(await findProjectIcon(root)).toBe('frontend/public/favicon.ico');
    });

    it('ignores icons inside vendor and node_modules', async () => {
      const candidates = await findProjectIconCandidates(root);
      expect(candidates.some(c => c.path.startsWith('vendor/'))).toBe(false);
      expect(candidates.some(c => c.path.startsWith('node_modules/'))).toBe(false);
    });
  });

  describe('Laravel root with two nested apps and a built duplicate', () => {
    beforeEach(async () => {
      await write('artisan');
      await write('frontend/package.json', JSON.stringify({ name: 'frontend' }));
      await write(
        'frontend/nuxt.config.ts',
        `export default { app: { head: { link: [
           { rel: 'icon', type: 'image/svg+xml', href: '/favicon/favicon.svg' },
           { rel: 'icon', type: 'image/png', href: '/favicon/favicon-96x96.png' },
         ] } } }`
      );
      await write('frontend/public/favicon/favicon.svg');
      await write('frontend/public/favicon/favicon-96x96.png');
      await write('frontend/public/favicon/apple-touch-icon.png');
      await write(
        'frontend/public/favicon/site.webmanifest',
        JSON.stringify({ icons: [{ src: '/favicon/favicon-96x96.png', sizes: '96x96' }] })
      );
      // Compiled copy of the same assets, served by Laravel.
      await write('public/spa/favicon/favicon.svg');
      // A second, supporting app.
      await write('docs-site/package.json', JSON.stringify({ name: 'docs' }));
      await write('docs-site/public/favicon/favicon.svg');
      // Matches a favicon glob but is a binary Chrome database, not an image.
      await write('bot/.profile/Default/Favicons', 'SQLite format 3');
    });

    it('prefers the primary app to the docs sub-app and the built copy', async () => {
      expect(await findProjectIcon(root)).toBe('frontend/public/favicon/favicon.svg');
    });

    it('never offers the extension-less Favicons database as a candidate', async () => {
      const candidates = await findProjectIconCandidates(root);
      expect(candidates.some(c => c.path.includes('Favicons'))).toBe(false);
    });
  });

  describe('Astro site keeping favicons in a subdirectory', () => {
    beforeEach(async () => {
      await write('astro.config.mjs', 'export default {}');
      await write('package.json', JSON.stringify({ name: 'site' }));
      // A real site declares its icons in the layout as well as the manifest.
      await write(
        'src/layouts/BaseLayout.astro',
        [
          '<link rel="icon" type="image/svg+xml" href="/favicon/favicon.svg" />',
          '<link rel="icon" type="image/png" href="/favicon/favicon-96x96.png" />',
          '<link rel="apple-touch-icon" href="/favicon/apple-touch-icon.png" />',
        ].join('\n')
      );
      await write('public/favicon/favicon.svg');
      await write('public/favicon/favicon-96x96.png');
      await write('public/favicon/apple-touch-icon.png');
      await write(
        'public/favicon/site.webmanifest',
        JSON.stringify({ icons: [{ src: '/favicon/favicon-96x96.png', sizes: '96x96' }] })
      );
      for (const variant of ['logo-dark', 'logo-light']) {
        for (const scale of ['', '@2x', '@4x'])
          await write(`src/assets/images/${variant}${scale}.png`);
      }
      await write('dist/favicon/favicon.svg');
    });

    it('finds an icon one level below public/', async () => {
      expect(await findProjectIcon(root)).toBe('public/favicon/favicon.svg');
    });

    it('never picks anything out of dist/', async () => {
      const candidates = await findProjectIconCandidates(root);
      expect(candidates.every(c => !c.path.startsWith('dist/'))).toBe(true);
    });
  });

  describe('Astro site declaring icons in a layout template', () => {
    beforeEach(async () => {
      // There is no index.html: the declaration lives in the layout.
      await write('astro.config.mjs', 'export default {}');
      await write(
        'src/layouts/BaseLayout.astro',
        [
          '<link rel="icon" type="image/svg+xml" href="/favicon.svg" />',
          '<link rel="icon" type="image/png" sizes="32x32" href="/logo@2x.png" />',
        ].join('\n')
      );
      await write('public/favicon.svg');
      await write('public/logo@2x.png');
      await write('public/logo.png');
    });

    it('prefers the declared favicon', async () => {
      expect(await findProjectIcon(root)).toBe('public/favicon.svg');
    });

    it('treats a declared logo variant as a real candidate', async () => {
      const candidates = await findProjectIconCandidates(root);
      const declaredLogo = candidates.find(c => c.path === 'public/logo@2x.png');
      expect(declaredLogo?.source).toBe('html-link');
    });
  });

  describe('determinism', () => {
    it('returns the same icon across repeated runs', async () => {
      await write('public/favicon.svg');
      await write('public/logo.svg');
      await write('public/icon.png');

      const runs = await Promise.all([1, 2, 3, 4, 5].map(() => findProjectIcon(root)));
      expect(new Set(runs).size).toBe(1);
    });

    it('does not depend on the order files were created', async () => {
      const names = ['public/aaa.png', 'public/favicon.png', 'public/zzz.png'];
      for (const name of names) await write(name);
      const forward = await findProjectIcon(root);

      const other = await fs.mkdtemp(path.join(os.tmpdir(), 'icon-finder-'));
      try {
        for (const name of [...names].reverse()) {
          const full = path.join(other, name);
          await fs.mkdir(path.dirname(full), { recursive: true });
          await fs.writeFile(full, 'x');
        }
        expect(await findProjectIcon(other)).toBe(forward);
      } finally {
        await fs.rm(other, { recursive: true, force: true });
      }
    });
  });

  describe('bounds and degenerate inputs', () => {
    it('returns null for a directory with no images', async () => {
      await write('README.md', '# nothing here');
      expect(await findProjectIcon(root)).toBeNull();
    });

    it('returns null rather than throwing for a missing path', async () => {
      expect(await findProjectIcon(path.join(root, 'does-not-exist'))).toBeNull();
    });

    it('returns null rather than throwing for a file path', async () => {
      await write('a-file.txt');
      expect(await findProjectIcon(path.join(root, 'a-file.txt'))).toBeNull();
    });

    it('does not descend past the depth limit', async () => {
      await write('a/b/c/d/e/f/icon.png');
      expect(await findProjectIcon(root)).toBeNull();
    });

    it('skips a zero-byte image, which would fail to render', async () => {
      await write('public/favicon.svg', '');
      await write('public/logo.png', 'real bytes');
      expect(await findProjectIcon(root)).toBe('public/logo.png');
    });

    it('completes on a wide tree without exhausting the directory budget', async () => {
      await Promise.all(
        Array.from({ length: 400 }, (_, i) => write(`wide/dir-${i}/placeholder.txt`))
      );
      await expect(findProjectIcon(root)).resolves.toBeDefined();
    });
  });

  describe('fallback walk', () => {
    it('finds an icon in an unconventional location', async () => {
      await write('design/brand/app-icon.png');
      // Nothing conventional or declared exists, so the bounded walk supplies it.
      expect(await findProjectIcon(root)).toBe('design/brand/app-icon.png');
    });

    it('ignores non-icon images in conventional directories', async () => {
      // Found against real projects: a Ghost theme screenshot in assets/, a
      // hero illustration and a framework placeholder in public/. A
      // conventional location alone does not make a file an icon.
      await write('assets/screenshot-desktop.jpg');
      await write('public/hero-visual.svg');
      await write('public/vercel.svg');

      expect(await findProjectIcon(root)).toBeNull();
    });

    it('ignores a Safari pinned-tab mask, which is a monochrome silhouette', async () => {
      await write('public/favicons/safari-pinned-tab.svg');
      await write('public/favicons/favicon-16x16.png');

      expect(await findProjectIcon(root)).toBe('public/favicons/favicon-16x16.png');
    });

    it('ignores images that are not icons', async () => {
      // A confidently wrong icon is worse than the folder glyph: the user gets
      // no signal that anything needs correcting.
      await write('src/views/screenshots/users.png');
      await write('src/data/webfonts/fa-solid-900.svg');
      await write('metadata-api/images/output/1.png');

      expect(await findProjectIcon(root)).toBeNull();
    });
  });
});
