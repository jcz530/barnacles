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
      external: ['@clack/prompts', 'picocolors', 'fs', 'path', 'child_process', 'url'],
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
