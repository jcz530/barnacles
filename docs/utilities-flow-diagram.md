# Utilities System Flow Diagram

## Component Interaction Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Interaction                          │
└─────────────────────────┬───────────────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              │                       │
         ┌────▼────┐            ┌────▼────┐
         │   UI    │            │   CLI   │
         │ (Vue)   │            │ Command │
         └────┬────┘            └────┬────┘
              │                      │
              │                      │
┌─────────────▼──────────┐  ┌────────▼─────────────┐
│  Frontend Registry     │  │  CLI Registry        │
│  (utilityRegistry)     │  │  (cliUtilityRegistry)│
│                        │  │                      │
│  Auto-discovers via:   │  │  Manually registers: │
│  import.meta.glob()    │  │  - color-converter   │
│                        │  │  - (future utils)    │
└─────────────┬──────────┘  └────────┬─────────────┘
              │                      │
              │                      │
              └──────────┬───────────┘
                         │
                 ┌───────▼────────┐
                 │ Shared Logic   │
                 │                │
                 │ /src/shared/   │
                 │  utilities/    │
                 │                │
                 │ - Conversion   │
                 │ - Validation   │
                 │ - Algorithms   │
                 └────────────────┘
```

## File Discovery & Registration

```
┌─────────────────────────────────────────────────────────────────┐
│                    Application Startup                           │
└─────────────────────────┬───────────────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              │                       │
         ┌────▼────────┐       ┌─────▼──────────┐
         │  Frontend   │       │   CLI Process  │
         │   (Vite)    │       │   (Node.js)    │
         └────┬────────┘       └─────┬──────────┘
              │                      │
              │                      │
   ┌──────────▼──────────┐    ┌──────▼───────────────┐
   │ User navigates to   │    │ User runs command    │
   │ /utilities          │    │ barnacles utilities  │
   └──────────┬──────────┘    └──────┬───────────────┘
              │                      │
   ┌──────────▼──────────┐    ┌──────▼───────────────┐
   │ discoverUtilities() │    │ registerCliUtilities()│
   │ is called           │    │ is called            │
   └──────────┬──────────┘    └──────┬───────────────┘
              │                      │
   ┌──────────▼──────────┐    ┌──────▼───────────────┐
   │ Vite glob finds:    │    │ Imports:             │
   │ ./*/index.ts        │    │ ./color-converter.js │
   └──────────┬──────────┘    └──────┬───────────────┘
              │                      │
   ┌──────────▼──────────┐    ┌──────▼───────────────┐
   │ Utilities register  │    │ CLI handlers         │
   │ themselves          │    │ register             │
   └──────────┬──────────┘    └──────┬───────────────┘
              │                      │
              └──────────┬───────────┘
                         │
                 ┌───────▼────────┐
                 │   Ready to     │
                 │   Execute      │
                 └────────────────┘
```

## Adding a New Utility (Developer Flow)

```
┌─────────────────────────────────────────────────────────────────┐
│  Developer wants to add new utility: "Base64 Encoder"           │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                 ┌────────▼─────────┐
                 │  1. Create folder│
                 │  base64-encoder/ │
                 └────────┬─────────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
    ┌────▼────┐     ┌────▼────┐     ┌────▼────┐
    │ index.ts│     │ View.vue│     │ logic.ts│
    │         │     │         │     │ (shared)│
    │ Metadata│     │   UI    │     │         │
    │ & CLI   │     │Component│     │ Encode/ │
    │ Handler │     │         │     │ Decode  │
    └────┬────┘     └────┬────┘     └────┬────┘
         │               │               │
         └───────────────┼───────────────┘
                         │
              ┌──────────▼──────────┐
              │  Utility auto-      │
              │  discovered!        │
              │                     │
              │  No other changes   │
              │  needed!            │
              └─────────────────────┘
```

## Utility Page Navigation

```
User clicks "Color Converter" card
         │
         ▼
┌─────────────────────┐
│  Router navigates   │
│  to: /utilities/    │
│  color-converter    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ UtilityDetail       │
│ Wrapper loads       │
└──────────┬──────────┘
           │
           ├─► Get utility from registry
           │
           ├─► Load component dynamically
           │   (ColorConverterView.vue)
           │
           ├─► Set breadcrumbs
           │   Utilities > Color Converter
           │
           ▼
┌─────────────────────┐
│  Utility component  │
│  renders with full  │
│  page layout        │
└─────────────────────┘
```

## CLI Execution Flow

```
$ barnacles utilities color-converter "#3b82f6"
         │
         ▼
┌─────────────────────┐
│ UtilitiesCommand    │
│ .execute() called   │
└──────────┬──────────┘
           │
           ├─► Parse args: ["color-converter", "#3b82f6"]
           │
           ├─► Extract utilityId: "color-converter"
           │
           ├─► Look up in cliUtilityRegistry
           │
           ▼
┌─────────────────────┐
│ colorConverterCli   │
│ .handler.execute()  │
└──────────┬──────────┘
           │
           ├─► Call convertColor("#3b82f6")
           │
           ├─► Format output with colors
           │
           ▼
┌─────────────────────┐
│  Print results:     │
│  HEX:   #3b82f6     │
│  RGB:   rgb(...)    │
│  HSL:   hsl(...)    │
└─────────────────────┘
```

## Category Organization

```
Utilities Page
├─── CSS & Design
│    └─── Color Converter
│
├─── Text Processing
│    └─── (future: Base64, URL Encoder, etc.)
│
├─── Data Conversion
│    └─── (future: JSON formatter, etc.)
│
└─── Development
     └─── (future: UUID generator, etc.)
```

## Registry Pattern

```
┌─────────────────────────────────────────────┐
│           Utility Registration              │
│                                             │
│  {                                          │
│    metadata: {                              │
│      id: 'color-converter',                 │
│      name: 'CSS Color Converter',           │
│      description: '...',                    │
│      icon: 'Palette',                       │
│      route: '/utilities/color-converter',   │
│      component: () => import('./View.vue'), │
│      cli: true,                             │
│      api: false,                            │
│      category: 'CSS & Design',              │
│      tags: ['color', 'css', 'hex']          │
│    },                                       │
│    cliHandler: {                            │
│      execute: async (args) => {...},        │
│      helpText: '...',                       │
│      examples: [...]                        │
│    }                                        │
│  }                                          │
└─────────────────────────────────────────────┘
```
