import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    outDir: 'dist/preload',
    lib: {
      entry: 'src/preload.ts',
      formats: ['cjs'],
      fileName: () => 'preload.js',
    },
    rollupOptions: {
      external: ['electron'],
    },
  },
});