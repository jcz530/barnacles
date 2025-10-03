# Electron + Vue + Hono Starter

A modern Electron application template featuring Vue.js frontend and Hono API backend running together in a single process.

Use this as a template to jump start your development and skip the setup.

## Architecture

This template provides a complete development setup for building desktop applications with:

- **Electron** - Cross-platform desktop app framework
- **Vue 3** - Progressive frontend framework with Composition API
- **Hono** - Lightweight, fast web framework for the backend API
- **TypeScript** - Full type safety across the entire application
- **shadcn-vue** - Modern UI component library
- **Tailwind CSS** - Utility-first CSS framework

### Project Structure

```
src/
├── main/           # Electron main process
├── backend/        # Hono API server (runs on port 3001)
├── frontend/       # Vue.js application
├── shared/         # Common types and utilities
└── preload.ts      # IPC bridge script
```

### Key Features

- **Single Process Architecture** - API server and frontend run together
- **Type-Safe Communication** - Shared types between frontend and backend
- **Modern UI Components** - Pre-configured shadcn-vue with Tailwind
- **Hot Reload** - Development mode with automatic reloading
- **Production Ready** - Build and packaging configured with Electron Forge

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone this repository:

```bash
git clone <your-repo-url>
cd <project-name>
```

2. Install dependencies:

```bash
npm install
```

3. Start development server:

```bash
npm run start
```

The application will launch with:

- Electron window running the Vue frontend
- Hono API server on `localhost:3001`
- Hot reload enabled for development

## Development Commands

| Command              | Description                                |
| -------------------- | ------------------------------------------ |
| `npm run start`      | Start the Electron app in development mode |
| `npm run lint`       | Run ESLint on the source code              |
| `npm run lint:fix`   | Run ESLint and automatically fix issues    |
| `npm run format`     | Format code with Prettier                  |
| `npm run type-check` | Run TypeScript type checking               |
| `npm run package`    | Package the app for distribution           |
| `npm run make`       | Build distributable packages               |

## Application Flow

1. **Main Process** (`src/main/main.ts`) initializes:
   - Hono API server on port 3001
   - IPC communication setup
   - Main application window

2. **Frontend** Vue application connects to API via HTTP requests
3. **Backend** Hono server provides REST API endpoints in `src/backend/routes/`

## Customization

### Adding API Routes

Create new route files in `src/backend/routes/` and register them in the main API setup.

### Adding Frontend Components

Follow the atomic design structure:

- `atoms/` - Basic UI elements
- `molecules/` - Simple component groups
- `organisms/` - Complex UI components
- `pages/` - Application screens

## Building for Production

```bash
npm run package  # Package for current platform
npm run make     # Create distributable installers
```

## Tech Stack Details

- **Electron Forge** - Build tooling and packaging
- **Vite** - Frontend build tool with hot reload
- **TanStack Query** - Data fetching and state management
- **VueUse** - Vue composition utilities
- **reka-ui** - Headless UI components (used by shadcn-vue)

## License

MIT
