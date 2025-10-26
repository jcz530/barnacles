# Barnacles CLI

The Barnacles CLI provides command-line access to Barnacles functionality, allowing you to manage projects, check status, and launch the application directly from your terminal.

## Installation

The CLI is automatically installed with the Barnacles application. After installing Barnacles, the `barnacles` command will be available in your terminal.

## Usage

```bash
barnacles <command> [options]
```

## Available Commands

### `projects` (alias: `p`)
Interactively browse and manage your tracked projects.

```bash
barnacles projects
# or use the shorthand alias
barnacles p
```

This command allows you to:
- Browse all projects tracked by Barnacles
- View project details (path, technologies, git branch, file count, etc.)
- Perform actions on selected projects:
  - **Start Processes** - Launch configured processes or select from package.json/composer.json scripts
  - **Stop Processes** - Stop all running processes for a project
  - **Open in Terminal** - Open a terminal in the project directory
  - **Copy Path** - Copy the project path to clipboard
  - **Open in Finder** - Reveal the project in Finder (macOS)

If you select "Start Processes" and don't have any configured processes, the CLI will:
1. Detect available scripts from your `package.json` and `composer.json`
2. Let you select which scripts to run
3. Save your selection for future use
4. Start the selected processes

The CLI will automatically launch the Barnacles app if it's not already running.

### `open` (alias: `o`)
Open or focus the Barnacles application window.

```bash
barnacles open
# or use the shorthand alias
barnacles o
```

If the app is already running, it will bring the window to focus. Otherwise, it will launch the application.

### `status`
Check the status of Barnacles and your projects.

```bash
barnacles status
```

Displays:
- App running status
- Database connection status
- Number of tracked projects
- Number of running processes

### `version`
Display the current version of Barnacles.

```bash
barnacles version
# or
barnacles --version
# or
barnacles -v
```

### `help`
Display help information about available commands.

```bash
barnacles help
# or
barnacles --help
# or
barnacles -h
# or get help for a specific command
barnacles projects --help
```

## Development

### Running the CLI in Development Mode

Build and run the CLI with automatic rebuilding:

```bash
npm run dev:cli
# This builds the CLI in development mode and runs it
# Add any CLI command after the script:
npm run dev:cli -- status
npm run dev:cli -- projects
```

### Building the CLI

Build the CLI for production:

```bash
npm run build:cli
```

### Testing Locally

Link the package globally for local testing:

```bash
npm link
barnacles help
barnacles projects
```

### Adding New Commands

1. Create a new command class in `src/cli/commands/` that extends `Command`
2. Implement the required properties and `execute()` method
3. Register the command in `src/cli/commands/index.ts`

Example:

```typescript
// src/cli/commands/my-command.ts
import { Command } from '../core/Command.js';
import { log } from '@clack/prompts';

export class MyCommand extends Command {
  readonly name = 'my-command';
  readonly description = 'Description of my command';
  readonly aliases = ['mc'];  // Optional: add short aliases
  readonly showIntro = true;
  readonly helpText = 'Detailed help text for this command.';
  readonly examples = ['barnacles my-command', 'barnacles mc'];

  async execute(flags: Record<string, string | boolean>): Promise<void> {
    log.info('Running my command!');
    // Your command implementation
  }
}
```

```typescript
// src/cli/commands/index.ts
import { MyCommand } from './my-command.js';

export const COMMANDS: Command[] = [
  // ... existing commands
  new MyCommand(),
];
```

### Adding New Project Actions

Project actions appear in the `projects` command after selecting a project:

1. Create a new action class in `src/cli/actions/` that implements `ProjectAction`
2. Register the action in `src/cli/actions/index.ts`

Example:

```typescript
// src/cli/actions/my-action.ts
import type { ProjectAction } from './types.js';
import type { ProjectWithDetails } from '../../backend/services/project-service.js';
import { log } from '@clack/prompts';

export class MyAction implements ProjectAction {
  readonly id = 'my-action';
  readonly label = 'My Action';
  readonly hint = 'Description of what this action does';

  async execute(project: ProjectWithDetails): Promise<void> {
    log.info(`Running action on ${project.name}`);
    // Your action implementation
  }
}
```

```typescript
// src/cli/actions/index.ts
import { MyAction } from './my-action.js';

export const PROJECT_ACTIONS: ProjectAction[] = [
  // ... existing actions
  new MyAction(),
];
```

## Architecture

The CLI is built as a standalone Node.js application that communicates with the Barnacles backend:

- **Entry Point**: `src/cli/index.ts` - Main CLI entry with argument parsing and command routing
- **Commands**: `src/cli/commands/` - Command implementations (projects, status, open, etc.)
- **Actions**: `src/cli/actions/` - Project-specific actions (start, stop, open in terminal, etc.)
- **Utils**: `src/cli/utils/` - Shared utilities:
  - `app-manager.ts` - Backend connection and app launching
  - `branding.ts` - CLI branding and logos
  - `colors.ts` - Color utilities using picocolors
  - `format-time.ts` - Time formatting helpers
- **Core**: `src/cli/core/` - Base command class and shared interfaces
- **Build Output**: `dist/cli/index.js` - Compiled CLI executable

### Communication Architecture

The CLI uses a hybrid approach for communicating with Barnacles:

- **Direct Service Access**: For operations that don't require native modules (database queries, file reading, etc.), the CLI imports and uses backend services directly
- **HTTP API**: For operations that require native modules like `node-pty` (process management), the CLI communicates with the Barnacles backend via HTTP
- **Auto-Launch**: If the Barnacles app is not running, the CLI will automatically launch it and wait for the backend to be ready

### Technologies

- **[Clack Prompts](https://github.com/bombshell-dev/clack)** - Enhanced terminal UI with spinners, autocomplete, and prompts
- **[picocolors](https://github.com/alexeyraspopov/picocolors)** - Terminal color formatting
- **Vite** - Build tooling with native module externalization
