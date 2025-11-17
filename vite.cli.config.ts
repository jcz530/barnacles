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
        // Node.js built-in modules
        'fs',
        'fs/promises',
        'path',
        'child_process',
        'url',
        'util',
        'os',
        'process',
        'tty',
        'readline',
        'node:path',
        'node:fs',
        'node:os',
        'node:process',
        'node:tty',
        'node:readline',
        'node:util',
        'crypto',
        'timers/promises',
        // Native modules (should not be imported by CLI, but listed to prevent bundling if accidentally imported)
        'better-sqlite3',
        'drizzle-orm',
        'node-pty',
      ],
      output: {
        // Add shims for CommonJS globals in ES modules
        banner: `
import { fileURLToPath as __fileURLToPath } from 'url';
import { dirname as __dirname_func } from 'path';
const __filename = __fileURLToPath(import.meta.url);
const __dirname = __dirname_func(__filename);
`,
      },
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
