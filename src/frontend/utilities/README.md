# Utilities System

This directory contains the extensible utilities system for Barnacles. Utilities are self-contained tools that provide helpful functionality for developers.

## Architecture

The utilities system uses a **convention-based, auto-discovery** pattern:

- Each utility is a self-contained folder
- Utilities are automatically discovered via `import.meta.glob()`
- Each utility registers itself by exporting metadata
- Utilities can have both UI (Vue components) and CLI handlers

## Creating a New Utility

### 1. Create a Utility Folder

Create a new folder in `src/frontend/utilities/` with a descriptive name:

```
src/frontend/utilities/
└── your-utility-name/
    ├── index.ts              # Registration file (required)
    ├── YourUtilityView.vue   # Vue component (required)
    └── logic.ts              # Business logic (optional)
```

### 2. Create the Registration File

Create `index.ts` that exports a `UtilityRegistration`:

```typescript
import type { UtilityRegistration } from '../types';

const registration: UtilityRegistration = {
  metadata: {
    id: 'your-utility-name',
    name: 'Your Utility Name',
    description: 'Brief description of what this utility does',
    icon: 'Wrench', // Lucide icon name
    route: '/utilities/your-utility-name',
    component: () => import('./YourUtilityView.vue'),
    cli: true, // Set to false if no CLI support
    api: false, // Set to true if it needs backend API
    category: 'Development', // Optional category
    tags: ['tag1', 'tag2'], // Optional tags
  },
  cliHandler: {
    async execute(args, flags) {
      // CLI implementation
      console.log('Running utility with args:', args);
    },
    helpText: 'Help text for CLI usage',
    examples: [
      'barnacles utilities your-utility-name arg1',
    ],
  },
};

export default registration;
```

### 3. Create the Vue Component

Create `YourUtilityView.vue`:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

// Your component logic here
const input = ref('');
</script>

<template>
  <div>
    <section class="mt-8">
      <div class="mb-6">
        <h2 class="text-2xl font-semibold">Your Utility Name</h2>
        <p class="text-muted-foreground mt-1">
          Description of what this utility does
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Utility Interface</CardTitle>
        </CardHeader>
        <CardContent>
          <!-- Your utility UI here -->
        </CardContent>
      </Card>
    </section>
  </div>
</template>
```

### 4. Add CLI Support (Optional)

If your utility has a CLI component, create the CLI handler:

1. Create `src/cli/utilities/your-utility-name.ts`:

```typescript
export const yourUtilityCli = {
  id: 'your-utility-name',
  name: 'Your Utility Name',
  description: 'Brief description',
  handler: {
    async execute(args: string[]) {
      // CLI implementation
    },
    helpText: 'Help text',
    examples: ['barnacles utilities your-utility-name'],
  },
};
```

2. Register it in `src/cli/utilities/registry.ts`:

```typescript
export function registerCliUtilities(): void {
  import('./your-utility-name.js').then(module => {
    cliUtilityRegistry.register(module.yourUtilityCli);
  });
}
```

### 5. Share Logic Between UI and CLI (Optional)

For complex logic, create shared functions in `src/shared/utilities/`:

```typescript
// src/shared/utilities/your-utility.ts
export function yourSharedLogic(input: string): string {
  // Shared logic that both UI and CLI can use
  return processedResult;
}
```

Then import it in both your Vue component and CLI handler.

## Example: Color Converter

See `src/frontend/utilities/color-converter/` for a complete example that includes:

- ✅ Vue component with interactive UI
- ✅ CLI handler with formatted output
- ✅ Shared logic in `src/shared/utilities/color-converter.ts`
- ✅ Full TypeScript types
- ✅ Proper error handling

## Available UI Components

You have access to all shadcn-vue components:

- `Card`, `CardContent`, `CardHeader`, `CardTitle`, `CardDescription`
- `Input`, `Button`, `Label`, `Slider`, `Switch`
- `Badge`, `Separator`, `Alert`
- And many more in `@/components/ui/`

## Icons

Use Lucide icons from `lucide-vue-next`:

```typescript
import { Wrench, Palette, Calculator } from 'lucide-vue-next';
```

See all icons at: https://lucide.dev/icons/

## Categories

Common categories for utilities:

- `Development` - General development tools
- `CSS & Design` - Design and styling utilities
- `Text Processing` - String and text manipulation
- `Data Conversion` - Format converters
- `Encoding` - Encoding/decoding utilities
- `Testing` - Testing and validation tools

## Testing Your Utility

1. **UI**: Run `npm run dev` and navigate to `/utilities`
2. **CLI**: Run `barnacles utilities your-utility-name`

Your utility will automatically appear in the grid!
