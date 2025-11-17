import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, chmodSync } from 'fs';

export default defineConfig({
  build: {
    outDir: 'dist/cli',
    lib: {
      entry: resolve(__dirname, 'src/cli/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: [
        '@clack/prompts',
        '@paralleldrive/cuid2',
        '@noble/hashes',
        'picocolors',
        'sisteransi',
        'dayjs',
        'better-sqlite3',
        'bindings',
        'prebuild-install',
        'drizzle-orm',
        'ignore',
        'node-pty',
        'nan',
        // Node.js built-in modules
        'fs',
        'fs/promises',
        'path',
        'child_process',
        'url',
        'util',
        'os',
        'node:path',
        'node:fs',
        'node:os',
        'crypto',
        'timers/promises',
      ],
    },
    target: 'node18',
    minify: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/frontend'),
    },
  },
  plugins: [
    {
      name: 'copy-cli-wrapper',
      closeBundle() {
        // Copy wrapper script to dist/cli
        const src = resolve(__dirname, 'src/cli/wrapper.sh');
        const dest = resolve(__dirname, 'dist/cli/barnacles');
        copyFileSync(src, dest);
        chmodSync(dest, 0o755);
      },
    },
  ],
});
