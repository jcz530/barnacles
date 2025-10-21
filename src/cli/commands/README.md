# CLI Commands

This directory contains all CLI commands for Barnacles. Commands use a class-based architecture inspired by Laravel's command pattern.

## Creating a New Command

### 1. Create a Command Class

Create a new file in `src/cli/commands/` that extends the `Command` base class:

```typescript
import { Command } from '../core/Command.js';

export class MyCommand extends Command {
  // Required: command name
  readonly name = 'my-command';

  // Required: command description
  readonly description = 'Does something useful';

  // Optional: command aliases
  readonly aliases = ['mc', 'my'];

  // Optional: whether to show intro/outro
  readonly showIntro = false;

  // Required: command implementation
  async execute(flags: Record<string, string | boolean>): Promise<void> {
    console.log('Hello from my command!');

    // Access flags
    if (flags.verbose) {
      console.log('Verbose mode enabled');
    }
  }

  // Optional: lifecycle hooks
  protected async beforeExecute(flags: Record<string, string | boolean>): Promise<void> {
    // Runs before execute
    console.log('Preparing...');
  }

  protected async afterExecute(flags: Record<string, string | boolean>): Promise<void> {
    // Runs after execute
    console.log('Cleanup...');
  }
}
```

### 2. Register the Command

Add your command to the registry in `src/cli/commands/index.ts`:

```typescript
import { MyCommand } from './my-command.js';

function registerCommands(): void {
  // Register your command
  registry.register(new MyCommand());

  // ... other commands
}
```

### 3. Test Your Command

Build and test your command:

```bash
npm run build:cli
node dist/cli/index.js my-command
node dist/cli/index.js mc  # test alias
```

## Command Properties

### Required Properties

- `name` - The primary command name (kebab-case recommended)
- `description` - Brief description shown in help
- `execute(flags)` - Async method that implements the command logic

### Optional Properties

- `aliases` - Array of alternative names for the command
- `showIntro` - Whether to show intro/outro branding (default: `false`)

### Lifecycle Hooks

- `beforeExecute(flags)` - Runs before `execute()`
- `afterExecute(flags)` - Runs after `execute()`

## Example Commands

### Simple Command

```typescript
export class StatusCommand extends Command {
  readonly name = 'status';
  readonly description = 'Check application status';

  async execute(): Promise<void> {
    console.log('Barnacles is running ✓');
  }
}
```

### Command with Aliases and Flags

```typescript
export class OpenCommand extends Command {
  readonly name = 'open';
  readonly description = 'Open the Barnacles application';
  readonly aliases = ['o', 'launch'];

  async execute(flags: Record<string, string | boolean>): Promise<void> {
    const path = flags.path as string | undefined;

    if (path) {
      console.log(`Opening project at ${path}`);
    } else {
      console.log('Opening Barnacles...');
    }

    // Launch logic here...
  }
}
```

### Command with Lifecycle Hooks

```typescript
export class BuildCommand extends Command {
  readonly name = 'build';
  readonly description = 'Build the project';
  readonly showIntro = true; // Show branding for long-running tasks

  protected async beforeExecute(): Promise<void> {
    console.log('Checking dependencies...');
  }

  async execute(): Promise<void> {
    console.log('Building project...');
    // Build logic...
  }

  protected async afterExecute(): Promise<void> {
    console.log('Build complete!');
  }
}
```

## Benefits of This Architecture

1. **Cohesive** - All command logic lives in one class
2. **Type-safe** - TypeScript ensures all required methods are implemented
3. **Reusable** - Share common functionality through the base class
4. **Testable** - Easy to unit test individual command classes
5. **Discoverable** - Just add a class and register it
6. **Maintainable** - Clear structure makes it easy to understand and modify

## Migration from Legacy Commands

Legacy function-based commands are temporarily wrapped for backwards compatibility. To migrate:

1. Create a new class extending `Command`
2. Move the function logic into the `execute` method
3. Add name, description, and aliases as class properties
4. Register the new class in `registerCommands()`
5. Remove the legacy function

Example migration:

**Before:**
```typescript
export async function myCommand(flags: Record<string, string | boolean>): Promise<void> {
  console.log('Hello!');
}
```

**After:**
```typescript
export class MyCommand extends Command {
  readonly name = 'my';
  readonly description = 'My command';

  async execute(flags: Record<string, string | boolean>): Promise<void> {
    console.log('Hello!');
  }
}
```
