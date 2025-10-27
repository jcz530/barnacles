# Command Help System

The Barnacles CLI includes a comprehensive help system that provides documentation for both the CLI as a whole and individual commands.

## Usage

### General Help
Show all available commands:
```bash
barnacles help
barnacles --help
barnacles -h
```

### Command-Specific Help
Get detailed help for a specific command:
```bash
barnacles <command> --help
barnacles <command> -h
```

Examples:
```bash
barnacles projects --help
barnacles status -h
barnacles p --help    # Using alias
```

## Help Output Structure

Command-specific help displays:

1. **Command Name & Description** - What the command does
2. **Usage** - How to invoke the command, including aliases
3. **Description** - Detailed explanation of the command's purpose
4. **Options** - Command-specific flags and options
5. **Common Options** - Universal flags (--help, --version)
6. **Examples** - Real-world usage examples

### Example Output

```
projects - Browse and select projects

Usage:
  barnacles projects (p) [options]

Description:
  Interactively browse all projects tracked by Barnacles and perform actions on them.

Options:
  --help, -h  Show this help message

Common Options:
  --help, -h     Show this help message
  --version, -v  Show version information

Examples:
  $ barnacles projects
  $ barnacles p
  $ barnacles projects --help
```

## Adding Help to Commands

To add help documentation to a command, define these optional properties in your Command class:

```typescript
export class MyCommand extends Command {
  readonly name = 'my-command';
  readonly description = 'Short description for command list';

  // Optional: Detailed explanation
  readonly helpText = 'Longer description explaining what this command does in detail.';

  // Optional: Usage examples
  readonly examples = [
    'barnacles my-command',
    'barnacles my-command --flag',
    'barnacles my-command arg1 arg2',
  ];

  // Optional: Command-specific options
  readonly options = [
    {
      flag: '--flag, -f',
      description: 'Description of what this flag does',
    },
    {
      flag: '--output <path>',
      description: 'Specify output path',
    },
  ];
}
```

## Implementation Details

### Files

- **`src/cli/core/Command.ts`** - Base Command class with help properties
- **`src/cli/utils/command-help.ts`** - Help formatting utility
- **`src/cli/commands/index.ts`** - Command execution with help flag handling

### Help Flow

1. User runs `barnacles <command> --help`
2. Command is found in registry
3. Help flag is detected
4. `displayCommandHelp()` formats and displays help
5. Execution exits without running the command

### Styling

Help output uses `picocolors` for formatting:
- **Bold** - Section headers and command names
- **Dim** - Shell prompt symbols in examples
- **Regular** - All other text

This keeps the output clean and professional while maintaining readability.
