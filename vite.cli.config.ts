import { defineConfig } from 'vite';
import { resolve } from 'path';

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
        'picocolors',
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
        '@libsql/client',
        'drizzle-orm',
        'ignore',
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
});
