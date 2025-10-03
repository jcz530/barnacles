import { defineConfig } from 'vite';
import { builtinModules } from 'node:module';

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
        'tailwind-merge'
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
});