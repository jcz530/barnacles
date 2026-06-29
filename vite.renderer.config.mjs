import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

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
    alias: {
      '@': path.resolve('./src/frontend'),
    },
  },
  server: {
    // Keep in sync with APP_CONFIG.VITE_DEV_SERVER_PORT in src/shared/constants/index.ts
    port: 5734,
    strictPort: true,
  },
});