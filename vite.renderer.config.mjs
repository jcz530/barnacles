import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { APP_CONFIG } from './src/shared/constants/index.ts';

// https://vitejs.dev/config
export default defineConfig({
  plugins: [vue(), tailwindcss()],
  base: './', // This ensures relative paths in production builds
  build: {
    outDir: 'dist/renderer',
    rollupOptions: {
      input: 'index.html',
    },
  },
  resolve: {
    // Keep these in sync with `paths` in tsconfig.base.json, otherwise an
    // alias can type-check but fail to resolve at build time.
    alias: {
      '@': path.resolve('./src/frontend'),
      '@shared': path.resolve('./src/shared'),
    },
  },
  server: {
    port: APP_CONFIG.VITE_DEV_SERVER_PORT,
    strictPort: true,
  },
});
