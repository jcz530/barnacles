# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Important Rules To Follow

Never delete the database or its tables

## Development Commands

### Running the App

- `npm run dev` - Start the Electron app in development mode with hot reload
- `npm run start` - Start the Electron app from built files (production-like)

### Building the App

**For quick local testing (no signing/notarizing - much faster!):**
- `npm run dist:local` - Build local app without signing (defaults to macOS)
- `npm run dist:mac:local` - Build local macOS app without signing
- `npm run dist:win:local` - Build local Windows app without signing
- `npm run dist:linux:local` - Build local Linux app without signing

**For production releases (with signing/notarizing):**
- `npm run dist` - Build production app with signing (defaults to macOS)
- `npm run dist:mac` - Build production macOS app with signing
- `npm run dist:win` - Build production Windows app with signing
- `npm run dist:linux` - Build production Linux app with signing

Output will be in the `dist/` directory.

**Build Notes:**
- Local builds (`:local` scripts) skip code signing and notarization for much faster builds
- Local builds are suitable for testing but cannot be distributed
- Production builds require Apple Developer certificates and credentials in `.env` file
- The build script uses `CSC_IDENTITY_AUTO_DISCOVERY=false` to skip signing on local builds
- Notarization is skipped when `SKIP_NOTARIZE=true` environment variable is set

### Demo Mode and Screenshots

- `npm run dev:demo` - Run the app against a disposable database seeded with fake
  projects. Useful for demos and for working on UI without your real data.
- `npm run screenshots` - Capture product screenshots into `screenshots/out/`, one
  light and one dark PNG per page (`<name>-<theme>.png`)
- `npm run demo:reset` - Delete the local `.demo-data` profile

Demo mode is controlled by two env vars: `BARNACLES_DEMO=1` enables fake-data
seeding, and `BARNACLES_DATA_DIR` redirects the database and file caches to a
disposable profile. **`BARNACLES_DATA_DIR` is checked before the
`NODE_ENV=development` branch**, which otherwise resolves to `./database.db` —
the real dev database. The seeder additionally refuses to run unless the resolved
path is inside a `.demo-data` directory.

Demo fixtures live in `src/shared/database/demo/` and are hand-authored rather
than generated, so screenshots stay byte-stable between runs. `screenshots/manifest.mjs`
lists every captured page along with the title, description, and alt text used
when publishing. To publish new screenshots to the README and the marketing site,
use the `update-screenshots` skill.

Stop `npm run dev` before capturing — the app takes a single-instance lock.

### Code Quality

- `npm run lint` - Run ESLint on the source code
- `npm run lint:fix` - Run ESLint and automatically fix issues
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting with Prettier
- `npm run type-check` - Run TypeScript type checking without emitting files

**Important:** Always run `npm run format` after making code changes, before considering the work done.

### Testing

- `npm test` - Run all tests in watch mode
- `npm run test:unit` - Run backend unit tests
- `npm run test:integration` - Run backend integration tests
- `npm run test:cli` - Run CLI tests
- `npm run test:coverage` - Run tests with coverage report

**Important:** Always run tests through one of the `npm test*` scripts above (or `npx cross-env ELECTRON_RUN_AS_NODE=1 electron node_modules/vitest/vitest.mjs run <path>` for a single file). Never invoke `npx vitest` or `vitest` directly. Native modules like `better-sqlite3` are built against Electron's Node ABI (via the `postinstall` hook), not the system Node ABI, so the npm scripts run vitest inside Electron itself (`ELECTRON_RUN_AS_NODE=1 electron ...`) to match. Running bare `vitest` with system Node will crash with a `NODE_MODULE_VERSION` mismatch — do not "fix" this by running `npm rebuild`, which would rebuild the module for system Node and break the actual Electron app.

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

- **Electron** - Cross-platform desktop application framework
- **electron-builder** - Build tooling and packaging
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

### Colors and Theming

- **Never use color values that are not in our theme.** Do not use Tailwind's
  built-in color palettes (e.g. `text-green-600`, `bg-red-500`) or raw hex/rgb/hsl
  values in components. Always use the theme's color scales defined in
  `src/frontend/assets/css/main.css`.
- **Use `success` for green values** (e.g. `text-success-500`, `bg-success-500`,
  `border-success-500`).
- **Use `danger` for red values** (e.g. `text-danger-500`, `bg-danger-500`,
  `border-danger-500`).
- **`slate` is part of our theme** and should be used for neutral/gray values
  (e.g. `text-slate-500`).
- **Never use black or white** (no `text-black`, `bg-white`, `#000`, `#fff`,
  etc.). Always use a variant of `slate` instead (e.g. `bg-slate-50`,
  `text-slate-900`).
- **Exception**: brand identity colors (e.g. an IDE's or vendor's official
  color rendered as data, not theme styling) may use raw hex values.

### Libraries and Patterns

- **Composables**: Use VueUse for common functionality instead of recreating utilities
- **API Requests**: Use TanStack Query for all API calls and data fetching


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:1105d646 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/core-concepts/sync-concepts.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->
