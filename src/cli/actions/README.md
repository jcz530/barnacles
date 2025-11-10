# CLI Actions

This directory contains reusable actions that can be performed on projects. Actions follow a consistent pattern and can be easily shared across different commands.

## Architecture

### Core Components

- **`types.ts`** - Defines the `ProjectAction` interface that all actions must implement
- **`index.ts`** - Action registry that exports all available actions and provides helper functions
- **Individual action files** - Each action is implemented in its own file (e.g., `copy-path.ts`, `open-in-terminal.ts`)

### Action Interface

Every action must implement the `ProjectAction` interface:

```typescript
export interface ProjectAction {
  id: string;              // Unique identifier for the action
  label: string;           // Display label for the action
  hint?: string;           // Optional hint/description text
  execute(project: ProjectWithDetails): Promise<void>;  // Execute the action
}
```

## Creating a New Action

### Step 1: Create the Action File

Create a new file in `src/cli/actions/` (e.g., `my-action.ts`):

```typescript
import { log } from '@clack/prompts';
import type { ProjectAction } from './types.js';
import type { ProjectWithDetails } from '../../backend/services/project/index.js';

/**
 * Action to do something with the project
 */
export class MyAction implements ProjectAction {
  readonly id = 'my-action';
  readonly label = 'My Action';
  readonly hint = 'Description of what this action does';

  async execute(project: ProjectWithDetails): Promise<void> {
    // Your implementation here
    log.info(\`Doing something with: \${project.name}\`);
  }
}
```

### Step 2: Register the Action

Add your action to the registry in `index.ts`:

```typescript
import { MyAction } from './my-action.js';

export const PROJECT_ACTIONS: ProjectAction[] = [
  new ChangeDirectoryAction(),
  new CopyPathAction(),
  new MyAction(), // Add your action here
];
```

### Step 3: Use the Action

Actions are automatically available in any command that uses the action system:

```typescript
import { getActionOptions, getAction } from '../actions/index.js';

// Show action selection
const selectedActionId = await autocomplete({
  message: 'Select an action:',
  options: getActionOptions(),
});

// Execute the selected action
const action = getAction(String(selectedActionId));
await action.execute(project);
```

## Available Actions

### Copy Path (`path`)
Copies the project's path to the system clipboard (macOS only).

### Open in New Terminal Tab (`cd`)
Opens a new terminal tab/window at the project directory. Automatically detects which terminal you're using (iTerm2, Terminal.app, Warp, Alacritty, Kitty, Hyper, WezTerm) and opens a new tab in that application.

**Fallback behavior:** If terminal detection fails, presents an interactive prompt with options to:
- Copy the cd command to clipboard (recommended)
- Display the command to copy manually

### Open in Finder (`finder`)
Opens the project directory in Finder (macOS only).

## Examples

### Simple Action
```typescript
export class OpenInFinderAction implements ProjectAction {
  readonly id = 'finder';
  readonly label = 'Open in Finder';
  readonly hint = 'Open the project in Finder';

  async execute(project: ProjectWithDetails): Promise<void> {
    await exec(\`open "\${project.path}"\`);
    log.success('Opened in Finder');
  }
}
```

### Action with Error Handling
```typescript
export class GitRemoteAction implements ProjectAction {
  readonly id = 'git-remote';
  readonly label = 'Git Remote';
  readonly hint = 'Show git remote URL';

  async execute(project: ProjectWithDetails): Promise<void> {
    try {
      const { stdout } = await execAsync('git remote get-url origin', {
        cwd: project.path,
      });
      log.success(\`Remote: \${stdout.trim()}\`);
    } catch (error) {
      log.error('No git remote found');
    }
  }
}
```

## Best Practices

1. **Single Responsibility** - Each action should do one thing well
2. **Error Handling** - Always handle errors gracefully and provide useful feedback
3. **User Feedback** - Use `@clack/prompts` log functions for consistent user feedback
4. **Descriptive Names** - Use clear, descriptive names for action IDs and labels
5. **Documentation** - Add JSDoc comments to explain what the action does
6. **Platform Awareness** - Be mindful of platform-specific commands (macOS vs Linux vs Windows)

## Integration

This action system is currently used in:
- `projects` command (src/cli/commands/projects.ts)

New commands can easily integrate these actions using the registry pattern.
