import js from '@eslint/js';
import tsEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import vueEslint from 'eslint-plugin-vue';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import vueParser from 'vue-eslint-parser';

export default [
  // Base JavaScript config
  js.configs.recommended,

  // TypeScript files
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsEslint,
      prettier: prettierPlugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'prettier/prettier': 'error',
    },
  },

  // Vue files
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        ecmaVersion: 'latest',
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
    },
    plugins: {
      vue: vueEslint,
      '@typescript-eslint': tsEslint,
      prettier: prettierPlugin,
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      'prettier/prettier': 'error',
    },
  },

  // Backend/Main process files - Node.js environment
  {
    files: ['src/main/**/*.ts', 'src/backend/**/*.ts', 'src/shared/**/*.ts', 'scripts/**/*.ts', 'drizzle.config.ts'],
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
        process: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        Response: 'readonly',
        MAIN_WINDOW_VITE_DEV_SERVER_URL: 'readonly',
        MAIN_WINDOW_VITE_NAME: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      'no-undef': 'error',
    },
  },

  // Frontend files - Browser environment
  {
    files: ['src/frontend/**/*.ts', 'src/frontend/**/*.vue'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        MouseEvent: 'readonly',
        HTMLElement: 'readonly',
      },
    },
  },

  // Type definition files - more lenient rules
  {
    files: ['**/*types*.ts', '**/types/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',
    },
  },

  // Apply Prettier config (disables conflicting rules)
  prettierConfig,

  // Global ignores
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '.vite/**',
      'out/**',
      '**/*.d.ts',
    ],
  },
];