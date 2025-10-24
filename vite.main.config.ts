import { defineConfig } from 'vite';
import { builtinModules } from 'node:module';
import { copyFileSync, mkdirSync } from 'fs';
import { join } from 'path';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    outDir: 'dist/main',
    lib: {
      entry: 'src/main/main.ts',
      formats: ['es'],
      fileName: () => 'main.js',
    },
    rollupOptions: {
      external: [
        'electron',
        ...builtinModules.flatMap(p => [p, `node:${p}`]),
        '@libsql/client',
        '@libsql/darwin-arm64',
        '@libsql/linux-x64',
        '@libsql/win32-x64',
        '@libsql/linux-arm64',
        '@libsql/win32-arm64',
        '@hono/node-server',
        'hono',
        'electron-squirrel-startup',
        '@paralleldrive/cuid2',
        'clsx',
        'drizzle-orm',
        'tailwind-merge',
        'ws',
        'bufferutil',
        'utf-8-validate',
        'node-pty',
      ],
    },
  },
  resolve: {
    // Some libs that can run in both Web and Node.js, such as `axios`, we need to tell Vite to build them in Node.js.
    conditions: ['node'],
    mainFields: ['module', 'jsnext:main', 'jsnext'],
  },
  optimizeDeps: {
    exclude: ['@libsql/client'],
  },
  plugins: [
    {
      name: 'copy-tray-icons',
      closeBundle() {
        // Copy tray icon assets to dist folder
        const assetsDir = join('dist', 'main', 'assets');
        mkdirSync(assetsDir, { recursive: true });

        copyFileSync(
          join('src', 'main', 'assets', 'tray-iconTemplate.png'),
          join(assetsDir, 'tray-iconTemplate.png')
        );
        copyFileSync(
          join('src', 'main', 'assets', 'tray-iconTemplate@2x.png'),
          join(assetsDir, 'tray-iconTemplate@2x.png')
        );
      },
    },
  ],
});
