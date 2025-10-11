![Barnacles](./assets/images/barnacles-social.png)

# Barnacles

A desktop application for developers to organize, manage, and analyze their coding projects. Barnacles automatically scans directories, detects technologies, tracks project metadata, and provides integrated terminals and IDE access.

Barnacles provides tools for everyday development. Easily find, open, or start your projects from a single interface.

## Download

You can download the latest release for your platform from the [Releases]() page.

## Features

- **Project Discovery** - Automatically scan directories to find and catalog all your development projects
- **Technology Detection** - Identify technologies, frameworks, and languages used in each project
- **Project Analytics** - View file counts, lines of code, language breakdowns, and project statistics
- **Git Integration** - Track branch status, commits, and repository information
- **Integrated Terminals** - Launch terminals directly in project directories
- **IDE Integration** - Quick access to open projects in your preferred IDE
- **Search & Filter** - Fuzzy search and filter projects by technology
- **Favorites** - Mark and quickly access your most-used projects

## Technology Stack

- **Electron** - Cross-platform desktop app framework
- **Vue 3** - Progressive frontend framework with Composition API
- **Hono** - Lightweight web framework for the backend API
- **TypeScript** - Full type safety across the entire application
- **shadcn-vue** - Modern UI component library
- **Tailwind CSS** - Utility-first CSS framework
- **Drizzle ORM** - Type-safe database access with SQLite

## Architecture

The application uses a single-process architecture with three main components:

```
src/
├── main/           # Electron main process (window management, lifecycle)
├── backend/        # Hono API server on port 3001
│   ├── routes/     # REST API endpoints
│   └── services/   # Business logic (scanning, detection, terminals)
├── frontend/       # Vue.js application
│   ├── components/ # UI components (atomic design pattern)
│   ├── views/      # Page-level components
│   └── composables/# Reusable Vue composition functions
├── shared/         # Common types and utilities
└── preload.ts      # IPC bridge script
```

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Installation

1. Clone this repository:

```bash
git clone https://github.com/yourusername/barnacles.git
cd barnacles
```

2. Install dependencies:

```bash
npm install
```

3. Initialize the database:

```bash
npm run db:migrate
```

4. Start the application:

```bash
npm run dev
```

The application will launch with:

- Electron window displaying the Barnacles UI
- Hono API server running on `localhost:3001`
- Hot reload enabled for development

### First-Time Setup

1. Open the Settings page to configure:
   - Default terminal application
   - Default IDE/code editor
   - Project scan depth (how many directory levels to search)

2. Navigate to the Projects page and click "Scan" to discover projects on your system

3. Browse, search, and organize your projects!

## Development Commands

| Command               | Description                                       |
| --------------------- | ------------------------------------------------- |
| `npm run dev`         | Start the app in development mode with hot reload |
| `npm run start`       | Start the app from built files (production-like)  |
| `npm run build`       | Build all components for production               |
| `npm run lint`        | Run ESLint on the source code                     |
| `npm run lint:fix`    | Run ESLint and automatically fix issues           |
| `npm run format`      | Format code with Prettier                         |
| `npm run type-check`  | Run TypeScript type checking                      |
| `npm run db:generate` | Generate database migrations                      |
| `npm run db:migrate`  | Run database migrations                           |
| `npm run dist`        | Build distributable packages for all platforms    |

## How It Works

### Project Scanning

Barnacles scans your file system to discover development projects by looking for common indicators like:

- `package.json` (JavaScript/TypeScript)
- `Cargo.toml` (Rust)
- `go.mod` (Go)
- `requirements.txt` (Python)
- `pom.xml` (Java/Maven)
- `.git` directories

### Technology Detection

For each project, Barnacles automatically detects:

- Programming languages and frameworks
- Build tools and package managers
- Testing frameworks
- Version control status
- File statistics and lines of code

### Data Management

- Projects are stored in a local SQLite database using Drizzle ORM
- File system scanning is non-intrusive (read-only)
- Project metadata is cached and can be refreshed on demand

## Building for Production

Build platform-specific distributables:

```bash
npm run dist        # Build for current platform
npm run dist:mac    # Build for macOS
npm run dist:win    # Build for Windows
npm run dist:linux  # Build for Linux
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Guidelines

- Follow the atomic design pattern for components
- Use TypeScript for type safety
- Keep files under 500 lines
- Use TanStack Query for API calls
- Use VueUse for common composables
- See `CLAUDE.md` for detailed development guidelines

## Project Structure

```
barnacles/
├── src/
│   ├── backend/              # Hono API server
│   │   ├── routes/           # API route handlers
│   │   ├── services/         # Business logic
│   │   └── middleware/       # Request middleware
│   ├── frontend/             # Vue.js application
│   │   ├── components/       # Reusable UI components
│   │   │   ├── atoms/        # Basic elements
│   │   │   ├── molecules/    # Simple component groups
│   │   │   ├── organisms/    # Complex components
│   │   │   └── ui/           # shadcn-vue components
│   │   ├── views/            # Page components
│   │   ├── composables/      # Vue composition functions
│   │   └── router/           # Vue Router configuration
│   ├── main/                 # Electron main process
│   ├── shared/               # Shared types and utilities
│   └── preload.ts           # Electron preload script
├── scripts/                  # Build and utility scripts
└── drizzle/                 # Database migrations
```

## Author

Created by [Joe Czubiak](https://joeczubiak.com)
