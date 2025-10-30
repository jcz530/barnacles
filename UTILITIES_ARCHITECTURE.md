# Utilities Feature - Architecture Documentation

## Overview

The Utilities feature provides an extensible, convention-based system for adding developer tools and converters to Barnacles. Each utility is self-contained and automatically discovered by the system.

## Key Design Principles

1. **Convention over Configuration** - Utilities follow a standard folder structure and are auto-discovered
2. **Self-Contained** - Each utility lives in its own folder with all its dependencies
3. **Full-Stack Support** - Utilities can have UI (Vue), CLI, and optional backend API support
4. **Easy to Add** - Adding a new utility requires minimal boilerplate

## Architecture Components

### Frontend (`src/frontend/utilities/`)

#### Core Infrastructure
- **`types.ts`** - TypeScript interfaces for utility metadata and registration
- **`index.ts`** - Registry system and auto-discovery using Vite's `import.meta.glob()`
- **`README.md`** - Developer guide for creating new utilities

#### Components
- **`components/utilities/molecules/UtilityCard.vue`** - Card component for displaying utilities in the grid
- **`components/utilities/organisms/UtilitiesGrid.vue`** - Grid layout with search and category filtering

#### Views
- **`views/Utilities.vue`** - Main utilities page showing grid of all utilities
- **`views/utilities/UtilityDetailWrapper.vue`** - Dynamic wrapper that loads individual utility pages

#### Individual Utilities
Each utility lives in its own folder:
```
utilities/
└── color-converter/
    ├── index.ts              # Metadata & CLI handler registration
    ├── ColorConverterView.vue # Vue component for UI
    └── (optional files)
```

### Backend (`src/backend/routes/`)

- **`utilities.ts`** - Placeholder API routes for future utilities that need server-side processing
- Registered in `routes/index.ts` as `/api/utilities`

### CLI (`src/cli/`)

#### Commands
- **`commands/utilities.ts`** - Main utilities CLI command with sub-command support
- Registered in `commands/index.ts`

#### Utilities Registry
- **`utilities/registry.ts`** - CLI-side registry (separate from frontend to avoid Vue imports)
- **`utilities/color-converter.ts`** - Example CLI utility implementation

### Shared (`src/shared/utilities/`)

- **`color-converter.ts`** - Shared business logic that both UI and CLI can use
- This is where complex algorithms and utilities should live

## How It Works

### Auto-Discovery Flow

1. User navigates to `/utilities` page
2. `Utilities.vue` calls `discoverUtilities()`
3. `discoverUtilities()` uses `import.meta.glob('./**/index.ts')` to find all utility registration files
4. Each utility's `index.ts` is dynamically imported
5. Utilities are registered in the `utilityRegistry`
6. `UtilitiesGrid` displays all registered utilities as cards

### Navigation Flow

1. User clicks a utility card
2. Router navigates to `/utilities/:utilityId`
3. `UtilityDetailWrapper` loads the utility's metadata from registry
4. Component from `metadata.component()` is dynamically imported
5. Component is rendered in the wrapper

### CLI Flow

1. User runs `barnacles utilities color-converter "#3b82f6"`
2. `UtilitiesCommand.execute()` is called
3. Command extracts utility ID (`color-converter`) and args
4. Looks up utility in `cliUtilityRegistry`
5. Calls utility's CLI handler with args
6. Output is printed to terminal

## File Structure

```
barnacles/
├── src/
│   ├── frontend/
│   │   ├── utilities/
│   │   │   ├── index.ts                    # Registry & auto-discovery
│   │   │   ├── types.ts                    # Type definitions
│   │   │   ├── README.md                   # Developer guide
│   │   │   └── color-converter/            # Example utility
│   │   │       ├── index.ts                # Registration
│   │   │       └── ColorConverterView.vue  # UI component
│   │   ├── components/
│   │   │   └── utilities/
│   │   │       ├── molecules/
│   │   │       │   └── UtilityCard.vue
│   │   │       └── organisms/
│   │   │           └── UtilitiesGrid.vue
│   │   ├── views/
│   │   │   ├── Utilities.vue               # Main utilities page
│   │   │   └── utilities/
│   │   │       └── UtilityDetailWrapper.vue
│   │   └── router/
│   │       └── index.ts                    # Routes registered here
│   │
│   ├── backend/
│   │   └── routes/
│   │       ├── index.ts                    # Utilities route registered
│   │       └── utilities.ts                # Utilities API endpoints
│   │
│   ├── cli/
│   │   ├── commands/
│   │   │   ├── index.ts                    # Utilities command registered
│   │   │   └── utilities.ts                # Main utilities command
│   │   └── utilities/
│   │       ├── registry.ts                 # CLI registry
│   │       └── color-converter.ts          # CLI implementation
│   │
│   └── shared/
│       └── utilities/
│           └── color-converter.ts          # Shared logic
│
└── UTILITIES_ARCHITECTURE.md               # This file
```

## Integration Points

### Sidebar Navigation
- Added in `src/frontend/components/nav/organisms/AppSidebar.vue`
- Uses Sparkles icon
- Route: `/utilities`

### Router
- Main route: `/utilities` → `Utilities.vue`
- Dynamic route: `/utilities/:utilityId` → `UtilityDetailWrapper.vue`

### Backend API
- Base route: `/api/utilities`
- Currently placeholder, ready for utilities that need server-side processing

### CLI
- Main command: `barnacles utilities`
- Sub-commands: `barnacles utilities <utility-id> [args]`
- Aliases: `util`, `u`

## Example: Color Converter

The Color Converter utility demonstrates all features:

### Frontend Component
- Interactive UI with color input
- Real-time conversion between formats
- Copy-to-clipboard functionality
- Example color values

### CLI Handler
- Accepts color input as argument
- Outputs all format conversions
- Colored terminal output
- Error handling with help text

### Shared Logic
- `convertColor()` function used by both UI and CLI
- Supports HEX, RGB, RGBA, HSL, HSLA
- Full TypeScript types

## Adding a New Utility

See `src/frontend/utilities/README.md` for detailed instructions.

### Quick Start

1. Create folder: `src/frontend/utilities/my-utility/`
2. Create `index.ts` with metadata
3. Create `MyUtilityView.vue` with UI
4. (Optional) Add CLI support in `src/cli/utilities/`
5. (Optional) Add shared logic in `src/shared/utilities/`

The utility will automatically appear in the UI!

## Benefits of This Architecture

✅ **Easy to Extend** - Drop in a new folder and it's automatically discovered
✅ **Self-Contained** - Each utility is isolated and can be removed easily
✅ **Type-Safe** - Full TypeScript support throughout
✅ **Consistent UI** - All utilities use the same components and styling
✅ **CLI Support** - Utilities can be used from command line
✅ **Shared Logic** - Business logic can be reused between UI and CLI
✅ **Scalable** - Can easily add dozens of utilities without cluttering codebase

## Future Enhancements

Potential additions:
- Utility favoriting/pinning
- Recent utilities history
- Utility-specific settings storage
- Backend API for complex processing
- Utility categories in sidebar sub-menu
- Search/filter improvements
- Utility usage analytics
