import { defineConfig } from 'vite';
import { builtinModules } from 'node:module';

/**
 * Builds the screenshot host for the capture script.
 *
 * The capture script needs the API (with its migrations and demo seeding) plus
 * the IPC bridges the renderer fetches through, without importing
 * dist/main/main.js, which grabs the single-instance lock and boots the tray,
 * menus, and the real application window.
 */
export default defineConfig({
  build: {
    outDir: 'dist/screenshots',
    emptyOutDir: true,
    lib: {
      entry: 'src/main/screenshot-host.ts',
      formats: ['es'],
      fileName: () => 'server.js',
    },
    rollupOptions: {
      external: [
        'electron',
        ...builtinModules.flatMap(p => [p, `node:${p}`]),
        'better-sqlite3',
        '@hono/node-server',
        'hono',
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
    conditions: ['node'],
    mainFields: ['module', 'jsnext:main', 'jsnext'],
  },
  optimizeDeps: {
    exclude: ['better-sqlite3'],
  },
});
