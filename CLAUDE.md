# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `npm run dev` - Start the Electron app in development mode with hot reload
- `npm run start` - Start the Electron app from built files (production-like)
- `npm run lint` - Run ESLint on the source code
- `npm run lint:fix` - Run ESLint and automatically fix issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting with Prettier
- `npm run type-check` - Run TypeScript type checking without emitting files
- `npm run package` - Package the app for distribution
- `npm run make` - Build distributable packages

## Architecture Overview

This is an Electron application with a Vue.js frontend and Hono API backend that run together in a single process:

### Main Architecture Components

- **Main Process** (`src/main/`) - Electron's main process that manages application lifecycle, windows, and native APIs
- **Backend API** (`src/backend/`) - Hono server running on port 3001 that provides REST API endpoints
- **Frontend** (`src/frontend/`) - Vue.js application that renders the UI using shadcn-vue components and Tailwind CSS
- **Shared** (`src/shared/`) - Common types, constants, and utilities used across processes
- **Preload** (`src/preload.ts`) - Bridge script for secure communication between renderer and main processes

### Key Application Flow

1. Main process starts (`src/main/main.ts`) and initializes:
   - Hono API server on port 3001
   - IPC communication setup
   - Main window creation
2. Frontend Vue app connects to the API server via HTTP requests (not IPC)
3. API server provides data through REST endpoints in `src/backend/routes/`

### Technology Stack

- **Electron Forge** - Build tooling and packaging
- **Vue 3** - Frontend framework with Composition API
- **Hono** - Lightweight web framework for the backend API
- **shadcn-vue + reka-ui** - UI component library
- **Tailwind CSS** - Utility-first CSS framework
- **TypeScript** - Type safety across the entire application
- **Vite** - Build tool for frontend bundling

### Important Configuration

- API server runs on `localhost:3001` (configurable in `src/shared/constants/`)
- Window dimensions and constraints defined in `APP_CONFIG.WINDOW_SIZE`
- API routes are centrally defined in `API_ROUTES` constant

## Code Organization and Standards

### File Size and Structure
- Keep files under 500 lines of code by separating logic into focused modules
- Maintain clear separation of concerns across files

### Frontend Organization
- **Component Structure**: Use atomic design principles for organizing components:
  - `atoms/` - Basic building blocks (buttons, inputs, labels)
  - `molecules/` - Simple groups of atoms (search bars, form fields)
  - `organisms/` - Complex UI components (headers, sidebars, forms)
  - `templates/` - Page-level layouts
  - `pages/` - Specific instances of templates
- **UI Components**: shadcn-vue components should remain in the `ui/` folder
- **Vue File Structure**: Order sections as script → template → style
  ```vue
  <script setup lang="ts">
  // Component logic
  </script>

  <template>
    <!-- Template markup -->
  </template>

  <style scoped>
  /* Component styles */
  </style>
  ```

### Libraries and Patterns
- **Composables**: Use VueUse for common functionality instead of recreating utilities
- **API Requests**: Use TanStack Query for all API calls and data fetching