# Theming System Architecture

A guide to how the Barnacles theming system works, written so someone could recreate the same approach in another application.

## Overview

The system lets users pick from pre-built themes or create fully custom ones. Each theme is defined by just **6 base hex colors**, **3 font families**, and a **border radius** setting. From those 6 colors, a shade generator produces full 11-step color palettes (50-950) in the OKLCH color space. These palettes are injected as CSS custom properties onto `document.documentElement`, which Tailwind CSS v4 reads through its `@theme` directive. Dark mode works by swapping light and dark shades at runtime.

**Tech stack:** Vue 3, Tailwind CSS v4, VueUse, culori (color library), TanStack Query, SQLite (via Drizzle ORM), Hono (REST API).

---

## 1. Theme Data Model

A theme is stored in a database with these fields:

| Field | Type | Purpose |
|---|---|---|
| `id` | string (CUID2) | Unique identifier |
| `name` | string (unique) | Display name |
| `isDefault` | boolean | Pre-defined themes can't be deleted |
| `isActive` | boolean | Only one theme is active at a time |
| `primaryColor` | hex string | Main brand color (e.g. `#00c2e5`) |
| `secondaryColor` | hex string | Accent color (e.g. `#ec4899`) |
| `tertiaryColor` | hex string | Third accent (e.g. `#8b5cf6`) |
| `slateColor` | hex string | Neutral/gray base (e.g. `#64748b`) |
| `successColor` | hex string | Success state (e.g. `#10b981`) |
| `dangerColor` | hex string | Error/danger state (e.g. `#ef4444`) |
| `fontUi` | string \| null | Body/UI font family |
| `fontHeading` | string \| null | Heading font family |
| `fontCode` | string \| null | Monospace font family |
| `borderRadius` | enum | `'none' \| 'sm' \| 'md' \| 'lg' \| 'xl'` |
| `customCssVars` | JSON string \| null | Escape hatch for arbitrary CSS variable overrides |

**Key design decision:** Store only the 6 *base* colors in the database, not all 66 individual shades. The full palettes are generated at runtime. This keeps the data model simple and makes it easy for users to create themes by picking just 6 colors.

---

## 2. Shade Generation (OKLCH Color Space)

This is the core of the system. Given a single hex color, generate 11 shades that look like a Tailwind color scale (50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950).

### Why OKLCH?

OKLCH is a perceptually uniform color space. Unlike HSL, equal steps in OKLCH lightness look like equal steps to human eyes. This means you can generate a palette from any arbitrary color and it will feel consistent.

### The Algorithm

The shade generator (`culori` library handles color conversion) works in three steps:

**Step 1: Parse the base color to OKLCH**
Convert the input hex color to OKLCH, giving you a lightness (L), chroma (C), and hue (H) value.

**Step 2: Generate a lightness scale**
Create 11 target lightness values distributed from light (96%) to dark (15%). The distribution uses a configurable cubic ease-in-out curve (controlled by a `lightnessCurve` parameter, default 0.5) that provides better separation in both the light and dark ends of the scale:

```
Shade 50:  ~96% lightness (very light)
Shade 100: ~88%
Shade 200: ~80%
...
Shade 500: ~55% (middle)
...
Shade 900: ~22%
Shade 950: ~15% lightness (very dark)
```

The curve blends between a linear distribution and a cubic ease-in-out, giving more visual separation where the eye is most sensitive.

**Step 3: Generate each shade**
For each of the 11 target lightness values:
1. Set the lightness to the target value
2. Keep the hue from the base color
3. Adjust the chroma based on the shade position using an algorithm preset

The chroma adjustment follows a curve that matches Tailwind's color scales:
- Light shades (50-200): reduce chroma significantly (less saturated pastels)
- Mid shades (400-600): keep chroma close to the base color
- Dark shades (800-950): slight chroma reduction

Three algorithm presets are available:
- **`tailwind`** (default): Mimics Tailwind's official color curves
- **`vibrant`**: Maintains higher saturation throughout
- **`natural`**: More desaturation at the extremes

A `chromaIntensity` multiplier (default: 1.0) provides further control. Values below 1 create more muted palettes, above 1 creates more vivid ones.

### Output

For each shade, the generator outputs:
- Shade name (50, 100, ..., 950)
- Hex value
- RGB string
- OKLCH values
- Lightness percentage

---

## 3. CSS Variable Architecture

The system uses a three-layer CSS variable architecture:

### Layer 1: Color Palette Variables (set by JavaScript)

These are the raw color values, set dynamically on `document.documentElement`:

```css
--color-primary-50:  #e8fbff;
--color-primary-100: #c5f4ff;
--color-primary-200: #96e9ff;
/* ... through 950 for each of the 6 color groups */
--color-slate-50: ...
--color-secondary-50: ...
--color-tertiary-50: ...
--color-success-50: ...
--color-danger-50: ...
```

That's 6 colors x 11 shades = **66 CSS variables** set at runtime.

### Layer 2: Semantic Variables (defined in CSS)

These map palette variables to semantic meaning. Defined in `:root` in the main CSS file:

```css
:root {
  --background: var(--color-slate-50);
  --foreground: var(--color-slate-800);
  --card: var(--color-slate-50);
  --card-foreground: var(--color-slate-800);
  --popover: var(--color-slate-50);
  --popover-foreground: var(--color-slate-800);
  --primary: var(--color-primary-500);
  --primary-foreground: oklch(0.984 0.003 247.858);
  --muted: var(--color-slate-100);
  --muted-foreground: var(--color-slate-300);
  --accent: var(--color-slate-100);
  --accent-foreground: var(--color-slate-700);
  --destructive: var(--color-danger-400);
  --border: var(--color-slate-100);
  --input: var(--color-slate-100);
  --ring: var(--color-primary-400);
  --radius: 0.625rem;
  /* Sidebar-specific tokens */
  --sidebar: var(--color-slate-200);
  --sidebar-foreground: var(--color-slate-800);
  --sidebar-accent: var(--color-primary-500);
  --sidebar-border: var(--color-slate-300);
  /* ... etc */
}
```

Because these reference the palette variables, changing `--color-slate-50` automatically updates `--background`, `--card`, etc.

### Layer 3: Tailwind CSS v4 Theme Mapping

Tailwind v4 uses a CSS-based configuration. An `@theme inline` block maps the CSS variables into Tailwind's utility class system:

```css
@theme inline {
  /* Palette colors -> Tailwind utilities */
  --color-primary-50: var(--color-primary-50);
  --color-primary-100: var(--color-primary-100);
  /* ... all 66 palette variables */

  /* Semantic colors -> Tailwind utilities */
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-border: var(--border);
  /* ... etc */

  /* Radius tokens with calc() adjustments */
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}
```

This means components can use classes like `bg-primary-500`, `text-foreground`, `border-border`, `rounded-lg` and they all resolve to the current theme's CSS variables.

### Typography Variables

Three font CSS variables control the entire app's typography:

```css
/* In components via CSS */
body { font-family: var(--font-ui, 'Istok Web', sans-serif); }
h1-h6 { font-family: var(--font-heading, 'Istok Web', sans-serif); }
code, pre { font-family: var(--font-code, ui-monospace, monospace); }
```

These are set by JavaScript when a theme is applied. If a theme doesn't specify a font, the CSS fallback is used.

---

## 4. Applying Themes at Runtime

The `applyThemeVariables(theme)` function is the heart of theme application. Here's what it does:

```
1. Take the theme's 6 base hex colors
2. For each color, call generateShades() to produce 11 shades
3. For each of the 66 resulting shades, set a CSS variable on document.documentElement
   using VueUse's useCssVar() (e.g., --color-primary-500 = #00c2e5)
4. Map the borderRadius setting to a rem value and set --radius
5. Set font family variables if specified
6. Parse and apply any customCssVars JSON overrides
```

The border radius mapping:
```
none -> 0
sm   -> 0.375rem (6px)
md   -> 0.625rem (10px)
lg   -> 0.875rem (14px)
xl   -> 1.25rem  (20px)
```

Because everything flows through CSS variables, the entire UI updates instantly when `applyThemeVariables()` runs. No component re-renders needed.

### Live Preview

The theme editor uses the same `applyThemeVariables()` function for live preview. As the user adjusts colors, the function is called with a temporary theme object. This gives instant visual feedback without saving anything to the database.

---

## 5. Dark Mode via Color Inversion

Rather than defining a completely separate set of dark mode colors, the system uses a **shade inversion** technique:

### How It Works

1. On initialization, store all current palette CSS variable values in a Map (the "light mode originals")
2. When dark mode activates, swap the shade values: `shade N` gets the value of `shade (1000 - N)`
   - Shade 50 (lightest) gets the value of shade 950 (darkest)
   - Shade 100 gets shade 900
   - Shade 200 gets shade 800
   - ...and so on
3. When light mode activates, restore the original values from the Map

This inversion is applied to all Tailwind color scales (slate, gray, zinc, red, blue, primary, etc. -- about 23 color families in total).

### Why This Works

Because components use semantic shade numbers (`bg-slate-50` for backgrounds, `text-slate-800` for text), swapping 50↔950, 100↔900 etc. automatically produces a dark UI:
- `bg-slate-50` (light background) becomes the value from `slate-950` (dark)
- `text-slate-800` (dark text) becomes the value from `slate-200` (light)

No component code changes needed. The semantic CSS variables in `:root` (like `--background: var(--color-slate-50)`) don't need a `.dark` override because the underlying palette variable values have already been swapped.

### Re-initialization After Theme Change

When the active theme changes, the color inversion must be re-initialized:

```javascript
// In App.vue
watch(activeTheme, (newTheme) => {
  if (newTheme) {
    setTimeout(() => {
      reinitializeColors(); // Clear stored originals, re-read current values, re-apply inversion
    }, 50); // Small delay to let theme CSS variables settle
  }
});
```

### Dark Mode Toggle

The toggle cycles through three states: `light` -> `dark` -> `auto`

- **Light/Dark**: Directly sets the `dark` class on `<html>` via VueUse's `useDark()`
- **Auto**: Reads `window.matchMedia('(prefers-color-scheme: dark)')` and follows the OS setting

The preference is stored in localStorage under the key `vueuse-color-scheme`.

---

## 6. Persistence & State Management

### Database (Source of Truth)

Themes are stored in SQLite via Drizzle ORM. Only one theme has `isActive = true` at a time. When activating a theme, all others are set to `isActive = false` first.

### localStorage (Fast Load)

The active theme ID is cached in localStorage (`active-theme-id`) so the frontend can request the right theme immediately on startup without waiting for a "get active theme" API call.

### TanStack Query (Data Fetching)

All API calls go through TanStack Query, which provides:
- Caching (prevents redundant fetches)
- Automatic cache invalidation after mutations (activate, create, update, delete)
- Loading/error states

### Data Flow

```
SQLite Database
      |
  Theme Service (backend business logic)
      |
  REST API Routes (/api/themes/*)
      |
  TanStack Query (frontend caching + fetching)
      |
  useTheme() composable
      |
  applyThemeVariables() -> useCssVar() on document.documentElement
      |
  CSS Variables
      |
  Tailwind @theme block -> utility classes
      |
  Components (bg-primary-500, text-foreground, etc.)
```

---

## 7. REST API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/themes` | List all themes |
| GET | `/api/themes/active` | Get the active theme |
| GET | `/api/themes/:id` | Get a single theme |
| POST | `/api/themes` | Create a custom theme |
| PUT | `/api/themes/:id` | Update a theme |
| DELETE | `/api/themes/:id` | Delete a custom theme |
| POST | `/api/themes/:id/activate` | Set a theme as active |
| POST | `/api/themes/:id/duplicate` | Clone a theme |
| POST | `/api/themes/:id/reset` | Reset a default theme to original values |
| POST | `/api/themes/initialize` | Seed default themes |

### Business Rules

- **Default themes** (12 built-in) cannot be deleted. Their core color properties cannot be changed directly -- users must duplicate them first to get a customizable copy.
- **Custom themes** can be freely created, edited, and deleted.
- **Deleting the active theme** automatically activates another theme.
- **`customCssVars`** is a JSON escape hatch -- any default theme can have arbitrary CSS variable overrides applied without modifying its protected core properties.

---

## 8. Default Themes

12 themes are seeded on first run:

| Theme | Primary | Secondary | Tertiary | Radius |
|---|---|---|---|---|
| Barnacles - Default | `#00c2e5` | `#ec4899` | `#8b5cf6` | md |
| Ocean Deep | `#0077be` | `#06b6d4` | `#3b82f6` | lg |
| Forest Green | `#10b981` | `#22c55e` | `#84cc16` | md |
| Sunset Orange | `#f97316` | `#fb923c` | `#fbbf24` | xl |
| Purple Haze | `#a855f7` | `#c026d3` | `#d946ef` | lg |
| Rose Pink | `#f43f5e` | `#ec4899` | `#fb7185` | md |
| Monochrome | `#525252` | `#737373` | `#a3a3a3` | sm |
| High Contrast | `#000000` | `#ffffff` | `#525252` | none |
| Nord Aurora | `#88c0d0` | `#81a1c1` | `#5e81ac` | md |
| Dracula Purple | `#bd93f9` | `#ff79c6` | `#8be9fd` | lg |
| Solarized | `#268bd2` | `#2aa198` | `#859900` | md |
| Tokyo Night | `#7aa2f7` | `#bb9af7` | `#7dcfff` | lg |

---

## 9. How to Recreate This System

### Minimum Viable Implementation

1. **Install dependencies:** `culori` (color math), a CSS variable setter (or just use `document.documentElement.style.setProperty()`)

2. **Build the shade generator:** Take a hex color, convert to OKLCH via culori, distribute 11 lightness values from 96% down to 15%, adjust chroma per shade position, convert back to hex.

3. **Define your CSS variable contract:** Decide on your color roles (primary, secondary, neutral, success, danger at minimum). Create CSS variables for each role's 11 shades.

4. **Wire Tailwind v4:** Use `@theme inline {}` to map your CSS variables to Tailwind's color utilities so you can write `bg-primary-500` etc.

5. **Build the application function:** Take a theme config (6 hex colors + radius + fonts), generate shades for each, set all CSS variables on `documentElement`.

6. **Add dark mode:** Store original shade values, swap shade N with shade (1000-N) when dark mode activates, restore originals when deactivating.

7. **Persist themes:** Store theme configs in your database of choice. Only store the 6 base colors, not the full palettes.

### What You Can Skip

- The REST API layer (if your app doesn't need server-side theme management)
- TanStack Query (if you don't need the caching layer)
- `customCssVars` JSON escape hatch (nice-to-have, not essential)
- Multiple algorithm presets in the shade generator (the `tailwind` preset alone is sufficient)

### What You Shouldn't Skip

- **OKLCH color space** for shade generation. HSL produces visually inconsistent results across different hues.
- **CSS variables as the bridge** between your theme data and components. This is what makes instant theme switching possible without re-renders.
- **Shade inversion for dark mode.** It's far simpler than maintaining parallel dark mode definitions and works automatically with any theme.
- **Storing only base colors, not full palettes.** Generating at runtime keeps the data model clean and makes theme creation trivial for users.