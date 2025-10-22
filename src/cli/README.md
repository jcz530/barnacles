# Barnacles CLI

The Barnacles CLI provides command-line access to Barnacles functionality.

## Installation

The CLI is automatically installed with the Barnacles application. After installing Barnacles, the `barnacles` command will be available in your terminal.

## Usage

```bash
barnacles <command> [options]
```

## Available Commands

### `open` (alias: `o`)
Open or focus the Barnacles application window.

```bash
barnacles open
# or use the shorthand alias
barnacles o
```

If the app is already running, it will bring the window to focus. Otherwise, it will launch the application.

### `status`
Check the status of Barnacles.

```bash
barnacles status
```

Returns: "online"

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
```

## Development

### Building the CLI

```bash
npm run build:cli
```

### Testing Locally

Link the package globally for local testing:

```bash
npm link
barnacles help
```

### Adding New Commands

1. Create a new command file in `src/cli/commands/`
2. Export an async function that accepts flags as a parameter
3. Register the command in `src/cli/commands/index.ts`

Example:

```typescript
// src/cli/commands/my-command.ts
export async function myCommand(flags: Record<string, string | boolean>): Promise<void> {
  // Your command implementation
}
```

```typescript
// src/cli/commands/index.ts
import { myCommand } from './my-command.js';

export const commands: Command[] = [
  // ... existing commands
  {
    name: 'my-command',
    description: 'Description of my command',
    aliases: ['mc'],  // Optional: add short aliases
    execute: myCommand,
  },
];
```

## Architecture

- **Entry Point**: `src/cli/index.ts` - Main CLI entry with argument parsing
- **Commands**: `src/cli/commands/` - Individual command implementations
- **Utils**: `src/cli/utils/` - Shared utilities like argument parser
- **Build Output**: `dist/cli/index.js` - Compiled CLI executable

The CLI uses [Clack Prompts](https://github.com/bombshell-dev/clack) for enhanced terminal UI.
